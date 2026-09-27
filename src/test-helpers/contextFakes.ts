import type { SchedulerContext } from "@/entrypoints/selection.content/scheduler";

export interface FakeContext {
	readonly context: SchedulerContext;
	readonly invalidate: () => void;
	readonly listenerCount: () => number;
}

export function createFakeContext(): FakeContext {
	const abortController = new AbortController();
	let listeners = 0;

	return {
		context: {
			get isInvalid(): boolean {
				return abortController.signal.aborted;
			},
			onInvalidated: (callback: () => void): (() => void) => {
				listeners += 1;
				abortController.signal.addEventListener("abort", callback);
				return (): void => {
					abortController.signal.removeEventListener("abort", callback);
				};
			},
		},
		invalidate: (): void => {
			abortController.abort();
		},
		listenerCount: (): number => listeners,
	};
}
