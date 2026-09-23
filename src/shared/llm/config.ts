export const LLM_CONFIG = Object.freeze({
	retryBaseDelayMs: 1000,
	retryMaxAttempts: 3,
	retryMaxDelayMs: 30_000,
	rateLimitCapacity: 5,
	rateLimitRefillPerSecond: 2,
	translationQueueConcurrency: 3,
});
