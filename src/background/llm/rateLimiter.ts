export interface RateLimiter {
	readonly acquire: () => Promise<void>;
}

interface TokenBucketRateLimiterDependencies {
	readonly capacity: number;
	readonly now: () => number;
	readonly refillPerSecond: number;
	readonly sleep: (ms: number) => Promise<void>;
}

function refillTokens(
	currentTime: number,
	state: { lastRefill: number; tokens: number },
	dependencies: Pick<
		TokenBucketRateLimiterDependencies,
		"capacity" | "refillPerSecond"
	>,
): void {
	const elapsedMs = Math.max(0, currentTime - state.lastRefill);
	const replenishedTokens =
		state.tokens + (elapsedMs / 1000) * dependencies.refillPerSecond;
	state.tokens = Math.min(dependencies.capacity, replenishedTokens);
	state.lastRefill = currentTime;
}

function computeWaitMs(
	availableTokens: number,
	refillPerSecond: number,
): number {
	const missingTokens = Math.max(0, 1 - availableTokens);
	return Math.ceil((missingTokens / refillPerSecond) * 1000);
}

export function createTokenBucketRateLimiter(
	dependencies: TokenBucketRateLimiterDependencies,
): RateLimiter {
	const capacity = dependencies.capacity;
	const refillPerSecond = dependencies.refillPerSecond;
	const state = {
		lastRefill: dependencies.now(),
		tokens: capacity,
	};

	const acquire = async (): Promise<void> => {
		refillTokens(dependencies.now(), state, {
			capacity: capacity,
			refillPerSecond: refillPerSecond,
		});
		if (state.tokens >= 1) {
			state.tokens -= 1;
			return;
		}

		await dependencies.sleep(computeWaitMs(state.tokens, refillPerSecond));
		await acquire();
	};

	return {
		acquire: acquire,
	};
}
