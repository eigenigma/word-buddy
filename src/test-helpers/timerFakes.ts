import type { Timers } from "@/shared/utils/timers";

export interface ManualTimers {
	readonly pendingDelays: () => readonly number[];
	readonly runAll: () => void;
	readonly timers: Timers;
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
