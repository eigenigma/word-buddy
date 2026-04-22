import type { ContentScriptContext } from "wxt/utils/content-script-context";

import { LLM_CONFIG } from "@/shared/llm/config";

import {
	annotateBlock,
	findCandidateBlocks,
	isRelevantBlock,
	type MatcherState,
	rebuildMatcherState,
} from "./core";
import {
	createInvalidationController,
	type InvalidationController,
} from "./invalidation";
import type { AnnotatorLogger } from "./logger";
import {
	createMutationObserverController,
	type MutationObserverController,
} from "./mutationObserver";
import { createTranslationQueue, type TranslationQueue } from "./queue";

export interface AnnotatorRuntime {
	readonly invalidationController: InvalidationController;
	readonly mutationObserver: MutationObserverController;
	readonly observer: IntersectionObserver;
	readonly pendingBlocks: Set<HTMLElement>;
	readonly pendingForceBlocks: Set<HTMLElement>;
	readonly queue: TranslationQueue;
	readonly scheduleBlockAnnotate: (block: HTMLElement, force?: boolean) => void;
}

export interface CreateAnnotatorRuntimeDependencies {
	readonly ctx: ContentScriptContext;
	readonly logger: AnnotatorLogger;
	readonly processedBlocks: WeakSet<HTMLElement>;
	readonly state: MatcherState;
}

function createInitialObserver(
	scheduleBlockAnnotate: (block: HTMLElement, force?: boolean) => void,
): IntersectionObserver {
	const observer = new IntersectionObserver((entries): void => {
		for (const entry of entries) {
			if (!(entry.isIntersecting && isRelevantBlock(entry.target))) {
				continue;
			}

			observer.unobserve(entry.target);
			scheduleBlockAnnotate(entry.target);
		}
	});

	return observer;
}

export function createAnnotatorRuntime(
	dependencies: CreateAnnotatorRuntimeDependencies,
): AnnotatorRuntime {
	const { ctx, logger, processedBlocks, state } = dependencies;
	const pendingBlocks = new Set<HTMLElement>();
	const pendingForceBlocks = new Set<HTMLElement>();
	const queue = createTranslationQueue(LLM_CONFIG.translationQueueConcurrency);

	const scheduleBlockAnnotate = (block: HTMLElement, force = false): void => {
		if (ctx.isInvalid) {
			return;
		}

		if (pendingBlocks.has(block)) {
			if (force) {
				pendingForceBlocks.add(block);
			}
			return;
		}

		if (!force && processedBlocks.has(block)) {
			return;
		}

		pendingBlocks.add(block);
		queue.enqueue(async (): Promise<void> => {
			try {
				await annotateBlock(
					ctx,
					block,
					state,
					processedBlocks,
					(message, error) => {
						logger.warn(message, error);
					},
				);
			} finally {
				pendingBlocks.delete(block);
				const shouldRescan = pendingForceBlocks.delete(block);
				if (shouldRescan) {
					scheduleBlockAnnotate(block, true);
				}
			}
		});
	};

	const observer = createInitialObserver(scheduleBlockAnnotate);
	const rescanDocument = async (): Promise<void> => {
		// Rescans only see surviving raw text nodes because [data-wb-injected]
		// subtrees are skipped by the walker, so existing annotations stay intact.
		for (const block of findCandidateBlocks(document)) {
			scheduleBlockAnnotate(block, true);
		}
	};
	const invalidationController = createInvalidationController({
		rebuildMatcher: async (): Promise<void> => {
			await rebuildMatcherState(state);
		},
		rescanDocument: rescanDocument,
	});
	const mutationObserver = createMutationObserverController({
		isRelevantBlock: (element: Element): boolean => isRelevantBlock(element),
		scheduleBlockAnnotate: (block: HTMLElement): void => {
			scheduleBlockAnnotate(block, true);
		},
		windowRef: globalThis.window,
	});

	return {
		invalidationController: invalidationController,
		mutationObserver: mutationObserver,
		observer: observer,
		pendingBlocks: pendingBlocks,
		pendingForceBlocks: pendingForceBlocks,
		queue: queue,
		scheduleBlockAnnotate: scheduleBlockAnnotate,
	};
}

export function disposeAnnotatorRuntime(runtime: AnnotatorRuntime): void {
	runtime.invalidationController.dispose();
	runtime.queue.dispose();
	runtime.pendingBlocks.clear();
	runtime.pendingForceBlocks.clear();
	runtime.observer.disconnect();
	runtime.mutationObserver.stop();
}
