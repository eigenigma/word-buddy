import type {
	SchedulerContext,
	SchedulerTimers,
} from "@/entrypoints/selection.content/scheduler";

export interface FakeContext {
	readonly context: SchedulerContext;
	readonly invalidate: () => void;
	readonly listenerCount: () => number;
}

export interface ManualTimers {
	readonly pendingDelays: () => readonly number[];
	readonly runAll: () => void;
	readonly timers: SchedulerTimers;
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

export function createManualTimers(): ManualTimers {
	const pending = new Map<number, { callback: () => void; delay: number }>();
	let nextTimerId = 1;

	return {
		pendingDelays: (): readonly number[] =>
			Array.from(pending.values(), ({ delay }) => delay),
		runAll: (): void => {
			const due = Array.from(pending.values(), ({ callback }) => callback);
			pending.clear();
			for (const callback of due) {
				callback();
			}
		},
		timers: {
			clearTimeout: (timerId: number): void => {
				pending.delete(timerId);
			},
			setTimeout: (callback: () => void, delay: number): number => {
				const timerId = nextTimerId;
				nextTimerId += 1;
				pending.set(timerId, { callback: callback, delay: delay });
				return timerId;
			},
		},
	};
}
