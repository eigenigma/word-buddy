import type { ContentScriptContext } from "wxt/utils/content-script-context";

import { LLM_CONFIG } from "@/shared/llm/config";
import type { AhoCorasickMatcher } from "@/shared/matching/ahoCorasick";
import type { Timers } from "@/shared/utils/timers";

import {
	annotateBlock,
	findCandidateBlocks,
	isRelevantBlock,
	type TranslateBlock,
} from "./core";
import { createInvalidationController } from "./invalidation";
import type { AnnotatorLogger } from "./logger";
import {
	type CreateMutationObserver,
	createMutationObserverController,
} from "./mutationObserver";
import { createTranslationQueue } from "./queue";
import type { TextReplacement } from "./renderer";

type BlockEntry = Pick<IntersectionObserverEntry, "isIntersecting" | "target">;

export type VisibilityCallback = (entries: readonly BlockEntry[]) => void;

export type CreateVisibilityObserver = (
	callback: VisibilityCallback,
) => Pick<IntersectionObserver, "disconnect" | "observe" | "unobserve">;

interface BlockVisibility {
	readonly disconnect: () => void;
	readonly observe: (block: HTMLElement) => void;
}

export interface AnnotatorRuntime {
	readonly dispose: () => void;
	readonly invalidate: () => Promise<void>;
	readonly start: () => Promise<void>;
}

export interface AnnotatorRuntimeDependencies {
	readonly buildMatcher: () => Promise<AhoCorasickMatcher | null>;
	readonly createMutationObserver: CreateMutationObserver;
	readonly createVisibilityObserver: CreateVisibilityObserver;
	readonly ctx: Pick<ContentScriptContext, "isInvalid">;
	readonly documentRef: Document;
	readonly logger: AnnotatorLogger;
	readonly timers: Timers;
	readonly translate: TranslateBlock;
}

interface MatcherState {
	readonly generation: number;
	readonly matcher: AhoCorasickMatcher | null;
}

interface MatcherSlot {
	readonly current: () => MatcherState;
	readonly publish: (matcher: AhoCorasickMatcher | null) => void;
}

interface BlockRevisions {
	readonly bump: (block: HTMLElement) => void;
	readonly current: (block: HTMLElement) => number;
	readonly isCompleted: (block: HTMLElement) => boolean;
	readonly markCompleted: (block: HTMLElement, revision: number) => void;
}

interface BlockScheduler {
	readonly dispose: () => void;
	readonly markChanged: (block: HTMLElement) => void;
	readonly publishMatcher: (matcher: AhoCorasickMatcher | null) => void;
}

interface BlockSchedulerDependencies {
	readonly createVisibilityObserver: CreateVisibilityObserver;
	readonly isActive: () => boolean;
	readonly logger: AnnotatorLogger;
	readonly onReplace: (replacement: TextReplacement) => void;
	readonly translate: TranslateBlock;
}

// A block's revision moves whenever its text or the matcher changes, and a
// block is completed at the revision its last rendering task started from.
function createBlockRevisions(): BlockRevisions {
	const revisions = new WeakMap<HTMLElement, number>();
	const completedRevisions = new WeakMap<HTMLElement, number>();
	const current = (block: HTMLElement): number => revisions.get(block) ?? 0;

	return {
		bump: (block: HTMLElement): void => {
			revisions.set(block, current(block) + 1);
		},
		current: current,
		isCompleted: (block: HTMLElement): boolean =>
			completedRevisions.get(block) === current(block),
		markCompleted: (block: HTMLElement, revision: number): void => {
			completedRevisions.set(block, revision);
		},
	};
}

// Each published matcher gets a new generation, so a task can tell whether
// the matcher it started with is still the current one.
function createMatcherSlot(): MatcherSlot {
	let state: MatcherState = { generation: 0, matcher: null };

	return {
		current: (): MatcherState => state,
		publish: (matcher: AhoCorasickMatcher | null): void => {
			state = { generation: state.generation + 1, matcher: matcher };
		},
	};
}

function createBlockVisibility(
	createObserver: CreateVisibilityObserver,
	isActive: () => boolean,
	onVisible: (block: HTMLElement) => void,
): BlockVisibility {
	// Observed blocks not yet seen intersecting, each with an entry to come.
	const waiting = new WeakSet<Element>();
	const observer = createObserver((entries: readonly BlockEntry[]): void => {
		for (const entry of entries) {
			if (!entry.isIntersecting) {
				continue;
			}

			waiting.delete(entry.target);
			if (isRelevantBlock(entry.target)) {
				observer.unobserve(entry.target);
				onVisible(entry.target);
			}
		}
	});

	return {
		disconnect: (): void => {
			observer.disconnect();
		},
		// Observing anew delivers a fresh initial entry, which observing an
		// observed target would not. A waiting block needs none, and Gecko
		// unobserves by a linear search, so a page of them is left alone.
		observe: (block: HTMLElement): void => {
			if (isActive() && block.isConnected && !waiting.has(block)) {
				waiting.add(block);
				observer.unobserve(block);
				observer.observe(block);
			}
		},
	};
}

// Every annotation waits for its block to be visible, and a task renders and
// completes its block only if neither the block nor the matcher moved while
// its translation was pending.
function createBlockScheduler(
	dependencies: BlockSchedulerDependencies,
): BlockScheduler {
	const { isActive } = dependencies;
	const queue = createTranslationQueue(LLM_CONFIG.translationQueueConcurrency);
	const revisions = createBlockRevisions();
	const pendingBlocks = new WeakSet<HTMLElement>();
	const matchers = createMatcherSlot();

	const run = async (block: HTMLElement): Promise<void> => {
		const { generation, matcher } = matchers.current();
		const revision = revisions.current(block);
		const isCurrent = (): boolean =>
			isActive() &&
			matchers.current().generation === generation &&
			revisions.current(block) === revision;

		try {
			await annotateBlock(block, matcher, {
				isCurrent: isCurrent,
				onReplace: dependencies.onReplace,
				translate: dependencies.translate,
			});
			if (isCurrent()) {
				revisions.markCompleted(block, revision);
			}
		} catch (error: unknown) {
			dependencies.logger.warn("annotation failed:", error);
		} finally {
			pendingBlocks.delete(block);
			if (!isCurrent()) {
				visibility.observe(block);
			}
		}
	};
	const schedule = (block: HTMLElement): void => {
		if (
			isActive() &&
			!pendingBlocks.has(block) &&
			!revisions.isCompleted(block)
		) {
			pendingBlocks.add(block);
			queue.enqueue(() => run(block));
		}
	};
	const visibility = createBlockVisibility(
		dependencies.createVisibilityObserver,
		isActive,
		schedule,
	);

	return {
		// The disposed runtime stays reachable from its context until the page
		// unloads, so it lets go of the matcher, which can run to megabytes.
		dispose: (): void => {
			queue.dispose();
			visibility.disconnect();
			matchers.publish(null);
		},
		markChanged: (block: HTMLElement): void => {
			revisions.bump(block);
			// A pending block is observed again when its task finds it stale.
			if (!pendingBlocks.has(block)) {
				visibility.observe(block);
			}
		},
		publishMatcher: (matcher: AhoCorasickMatcher | null): void => {
			if (isActive()) {
				matchers.publish(matcher);
			}
		},
	};
}

export function createAnnotatorRuntime(
	dependencies: AnnotatorRuntimeDependencies,
): AnnotatorRuntime {
	const { documentRef } = dependencies;
	let disposed = false;

	const mutations = createMutationObserverController({
		createObserver: dependencies.createMutationObserver,
		isRelevantBlock: isRelevantBlock,
		onBlockChanged: (block: HTMLElement): void => {
			scheduler.markChanged(block);
		},
		timers: dependencies.timers,
	});
	const scheduler = createBlockScheduler({
		createVisibilityObserver: dependencies.createVisibilityObserver,
		isActive: (): boolean => !(disposed || dependencies.ctx.isInvalid),
		logger: dependencies.logger,
		onReplace: mutations.expectReplacement,
		translate: dependencies.translate,
	});
	const invalidation = createInvalidationController({
		rebuildMatcher: async (): Promise<void> => {
			scheduler.publishMatcher(await dependencies.buildMatcher());
		},
		rescanDocument: (): void => {
			for (const block of findCandidateBlocks(documentRef)) {
				scheduler.markChanged(block);
			}
		},
	});

	return {
		dispose: (): void => {
			disposed = true;
			invalidation.dispose();
			scheduler.dispose();
			mutations.stop();
		},
		invalidate: invalidation.onInvalidate,
		// The first scan is an invalidation, so one arriving mid-boot coalesces
		// with it.
		start: (): Promise<void> => {
			if (documentRef.body) {
				mutations.start(documentRef.body);
			}
			return invalidation.onInvalidate();
		},
	};
}
