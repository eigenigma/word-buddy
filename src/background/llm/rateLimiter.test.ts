import { describe, expect, it } from "vitest";

import { createTokenBucketRateLimiter } from "./rateLimiter";

function createHarness(options: {
	readonly capacity: number;
	readonly now: number;
	readonly refillPerSecond: number;
}): {
	advanceTo: (nextTime: number) => void;
	readonly limiter: ReturnType<typeof createTokenBucketRateLimiter>;
	readonly sleeps: number[];
} {
	const sleeps: number[] = [];
	let currentTime = options.now;
	const limiter = createTokenBucketRateLimiter({
		capacity: options.capacity,
		now: (): number => currentTime,
		refillPerSecond: options.refillPerSecond,
		sleep: async (ms: number): Promise<void> => {
			sleeps.push(ms);
			currentTime += ms;
		},
	});

	return {
		advanceTo: (nextTime: number): void => {
			currentTime = nextTime;
		},
		limiter: limiter,
		sleeps: sleeps,
	};
}

describe("createTokenBucketRateLimiter", () => {
	it("acquires immediately while tokens are still available", async () => {
		const harness = createHarness({
			capacity: 2,
			now: 0,
			refillPerSecond: 2,
		});

		await harness.limiter.acquire();
		await harness.limiter.acquire();

		expect(harness.sleeps).toEqual([]);
	});

	it("waits for replenishment when the bucket is empty", async () => {
		const harness = createHarness({
			capacity: 1,
			now: 0,
			refillPerSecond: 2,
		});

		await harness.limiter.acquire();
		await harness.limiter.acquire();

		expect(harness.sleeps).toEqual([500]);
	});

	it("treats backward clock jumps as zero elapsed refill time", async () => {
		const harness = createHarness({
			capacity: 1,
			now: 1000,
			refillPerSecond: 1,
		});

		await harness.limiter.acquire();
		harness.advanceTo(500);
		await harness.limiter.acquire();

		expect(harness.sleeps).toEqual([1000]);
	});
});
