import type { DebounceTimers } from "@/entrypoints/annotator.content/mutationObserver";
import {
	type AnnotatorRuntime,
	type CreateVisibilityObserver,
	createAnnotatorRuntime,
	type VisibilityCallback,
} from "@/entrypoints/annotator.content/runtime";
import type {
	TranslateParagraphInput,
	TranslationMap,
} from "@/shared/llm/types";
import {
	type AhoCorasickMatcher,
	createAhoCorasickMatcher,
} from "@/shared/matching/ahoCorasick";
import { sleep } from "@/shared/utils/async";

export interface TranslationCall {
	readonly input: TranslateParagraphInput;
	readonly reject: (error: Error) => void;
	readonly resolve: (translations: TranslationMap) => void;
}

export interface AnnotatorHarness {
	// Hands the runtime every mutation record made since the last delivery,
	// then runs the debounce that delivery started.
	readonly flushMutations: () => void;
	readonly isVisibilityObserved: (target: Element) => boolean;
	readonly observeCount: () => number;
	// Makes every observed block intersect and lets the tasks it starts settle.
	readonly reveal: () => Promise<void>;
	readonly runtime: AnnotatorRuntime;
	readonly translations: readonly TranslationCall[];
	readonly warnings: readonly unknown[];
}

export function createMatcher(
	...lemmas: readonly string[]
): AhoCorasickMatcher {
	return createAhoCorasickMatcher(
		lemmas.map((lemma) => ({ lemma: lemma, surface: lemma })),
	);
}

function createVisibility(): {
	readonly create: CreateVisibilityObserver;
	readonly observed: Set<Element>;
	readonly observeCount: () => number;
	readonly revealObserved: () => void;
} {
	const observed = new Set<Element>();
	let observeCount = 0;
	let deliver: VisibilityCallback = (): void => {
		throw new Error("No visibility observer was created.");
	};

	return {
		create: (callback: VisibilityCallback) => {
			deliver = callback;
			return {
				disconnect: (): void => {
					observed.clear();
				},
				observe: (target: Element): void => {
					observeCount += 1;
					observed.add(target);
				},
				unobserve: (target: Element): void => {
					observed.delete(target);
				},
			};
		},
		observed: observed,
		observeCount: (): number => observeCount,
		revealObserved: (): void => {
			deliver(
				Array.from(observed, (target) => ({
					isIntersecting: true,
					target: target,
				})),
			);
		},
	};
}

function createDebounceTimers(): {
	readonly run: () => void;
	readonly timers: DebounceTimers;
} {
	let pending: (() => void) | null = null;

	return {
		run: (): void => {
			const callback = pending;
			pending = null;
			callback?.();
		},
		timers: {
			clearTimeout: (): void => {
				pending = null;
			},
			setTimeout: (callback: () => void): number => {
				pending = callback;
				return 1;
			},
		},
	};
}

export function createAnnotatorHarness(
	matchers: readonly (AhoCorasickMatcher | null)[],
): AnnotatorHarness {
	const visibility = createVisibility();
	const debounce = createDebounceTimers();
	const translations: TranslationCall[] = [];
	const warnings: unknown[] = [];
	const heldRecords: MutationRecord[] = [];
	const remainingMatchers = [...matchers];
	let mutationObserver: MutationObserver | null = null;
	let onRecords: MutationCallback | null = null;

	const runtime = createAnnotatorRuntime({
		buildMatcher: async (): Promise<AhoCorasickMatcher | null> =>
			remainingMatchers.length > 1
				? (remainingMatchers.shift() ?? null)
				: (remainingMatchers[0] ?? null),
		createMutationObserver: (callback: MutationCallback): MutationObserver => {
			onRecords = callback;
			mutationObserver = new MutationObserver((records): void => {
				heldRecords.push(...records);
			});
			return mutationObserver;
		},
		createVisibilityObserver: visibility.create,
		ctx: { isInvalid: false },
		documentRef: document,
		logger: {
			warn: (...messages: readonly unknown[]): void => {
				warnings.push(messages);
			},
		},
		timers: debounce.timers,
		translate: (input: TranslateParagraphInput): Promise<TranslationMap> => {
			const { promise, reject, resolve } =
				Promise.withResolvers<TranslationMap>();
			translations.push({ input: input, reject: reject, resolve: resolve });
			return promise;
		},
	});

	return {
		flushMutations: (): void => {
			heldRecords.push(...(mutationObserver?.takeRecords() ?? []));
			if (mutationObserver !== null && heldRecords.length > 0) {
				onRecords?.(heldRecords.splice(0), mutationObserver);
			}
			debounce.run();
		},
		isVisibilityObserved: (target: Element): boolean =>
			visibility.observed.has(target),
		observeCount: visibility.observeCount,
		reveal: async (): Promise<void> => {
			visibility.revealObserved();
			await settle();
		},
		runtime: runtime,
		translations: translations,
		warnings: warnings,
	};
}

// Lets pending promise continuations and mutation records settle.
export async function settle(): Promise<void> {
	await sleep(0);
}

export function glossEach(call: TranslationCall | undefined): void {
	if (call === undefined) {
		throw new Error("Expected a translation request.");
	}

	call.resolve(
		Object.fromEntries(call.input.words.map((word) => [word, `${word}-zh`])),
	);
}

export async function startAndReveal(harness: AnnotatorHarness): Promise<void> {
	await harness.runtime.start();
	await harness.reveal();
}

export async function annotateOnce(harness: AnnotatorHarness): Promise<void> {
	await startAndReveal(harness);
	glossEach(harness.translations[0]);
	await settle();
	harness.flushMutations();
}
