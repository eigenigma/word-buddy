import type { ContentScriptContext } from "wxt/utils/content-script-context";

export type SchedulerContext = Pick<
	ContentScriptContext,
	"isInvalid" | "onInvalidated"
>;

export interface SchedulerTimers {
	readonly clearTimeout: (timerId: number) => void;
	readonly setTimeout: (callback: () => void, delay: number) => number;
}

export interface TimerScheduler {
	readonly schedule: (callback: () => void, delay: number) => void;
}

// WXT's context timer wrapper adds an invalidation listener per call and never
// removes it; one scheduler per content script keeps one listener for all
// timers.
export function createTimerScheduler(
	context: SchedulerContext,
	timers: SchedulerTimers,
): TimerScheduler {
	const pendingTimerIds = new Set<number>();

	context.onInvalidated((): void => {
		for (const timerId of pendingTimerIds) {
			timers.clearTimeout(timerId);
		}
		pendingTimerIds.clear();
	});

	return {
		schedule: (callback: () => void, delay: number): void => {
			// onInvalidated never fires for a context that is already invalid.
			if (context.isInvalid) {
				return;
			}

			const timerId = timers.setTimeout((): void => {
				pendingTimerIds.delete(timerId);
				if (!context.isInvalid) {
					callback();
				}
			}, delay);
			pendingTimerIds.add(timerId);
		},
	};
}
