import { describe, expect, it, vi } from "vitest";

import {
	createFakeContext,
	createManualTimers,
} from "@/test-helpers/schedulerFakes";
import { createTimerScheduler } from "./scheduler";

describe("createTimerScheduler", () => {
	it("registers one invalidation listener however many timers it sets", () => {
		const fake = createFakeContext();
		const manual = createManualTimers();
		const scheduler = createTimerScheduler(fake.context, manual.timers);

		scheduler.schedule((): void => undefined, 0);
		scheduler.schedule((): void => undefined, 50);
		scheduler.schedule((): void => undefined, 150);

		expect(fake.listenerCount()).toBe(1);
		expect(manual.pendingDelays()).toStrictEqual([0, 50, 150]);
	});

	it("runs each callback when its timer fires", () => {
		const manual = createManualTimers();
		const scheduler = createTimerScheduler(
			createFakeContext().context,
			manual.timers,
		);
		const calls: string[] = [];

		scheduler.schedule((): void => {
			calls.push("first");
		}, 0);
		scheduler.schedule((): void => {
			calls.push("second");
		}, 50);
		manual.runAll();

		expect(calls).toStrictEqual(["first", "second"]);
	});

	it("forgets a timer once it fires", () => {
		const fake = createFakeContext();
		const manual = createManualTimers();
		const clearTimeout = vi.fn(manual.timers.clearTimeout);
		const scheduler = createTimerScheduler(fake.context, {
			...manual.timers,
			clearTimeout: clearTimeout,
		});

		scheduler.schedule((): void => undefined, 0);
		manual.runAll();
		fake.invalidate();

		expect(clearTimeout).not.toHaveBeenCalled();
	});

	it("clears its pending timers when the context is invalidated", () => {
		const fake = createFakeContext();
		const manual = createManualTimers();
		const scheduler = createTimerScheduler(fake.context, manual.timers);

		scheduler.schedule((): void => undefined, 0);
		scheduler.schedule((): void => undefined, 50);
		fake.invalidate();

		expect(manual.pendingDelays()).toStrictEqual([]);
	});

	it("sets no timer once the context is invalid", () => {
		const fake = createFakeContext();
		const manual = createManualTimers();
		const scheduler = createTimerScheduler(fake.context, manual.timers);

		fake.invalidate();
		scheduler.schedule((): void => undefined, 0);

		expect(manual.pendingDelays()).toStrictEqual([]);
	});

	it("skips a callback whose context went invalid before it fired", () => {
		let invalid = false;
		const manual = createManualTimers();
		const scheduler = createTimerScheduler(
			{
				get isInvalid(): boolean {
					return invalid;
				},
				onInvalidated: (): (() => void) => (): void => undefined,
			},
			manual.timers,
		);
		const calls: string[] = [];

		scheduler.schedule((): void => {
			calls.push("fired");
		}, 0);
		invalid = true;
		manual.runAll();

		expect(calls).toStrictEqual([]);
	});
});
