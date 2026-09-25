import { describe, expect, it } from "vitest";

import { createTextResponse } from "@/test-helpers/httpResponses";

import { createExponentialRetryPolicy } from "./retryPolicy";

function createRetryPolicy(
	sleeps: number[],
): ReturnType<typeof createExponentialRetryPolicy> {
	const clock = { current: 1_700_000_000_000 };

	return createExponentialRetryPolicy({
		baseDelayMs: 1000,
		maxAttempts: 3,
		maxDelayMs: 30_000,
		now: (): number => clock.current,
		random: (): number => 0.5,
		sleep: async (ms: number): Promise<void> => {
			sleeps.push(ms);
			clock.current += ms;
		},
	});
}

describe("createExponentialRetryPolicy", () => {
	it("honors Retry-After before exponential backoff and eventually returns success", async () => {
		const sleeps: number[] = [];
		const responses = [
			createTextResponse("retry later", 429, { "Retry-After": "1" }),
			createTextResponse("server error", 500),
			createTextResponse("ok", 200),
		];
		let callIndex = 0;
		const policy = createRetryPolicy(sleeps);

		const response = await policy.attemptFetch(async (): Promise<Response> => {
			const nextResponse = responses[callIndex];
			callIndex += 1;
			if (!nextResponse) {
				throw new Error("Missing scripted response.");
			}
			return nextResponse;
		});

		expect(response.status).toBe(200);
		expect(callIndex).toBe(3);
		expect(sleeps).toEqual([1000, 1000]);
	});

	it("fails fast on non-retryable 404 responses", async () => {
		const sleeps: number[] = [];
		let callIndex = 0;
		const policy = createRetryPolicy(sleeps);

		const response = await policy.attemptFetch(async (): Promise<Response> => {
			callIndex += 1;
			return createTextResponse("not found", 404);
		});

		expect(response.status).toBe(404);
		expect(callIndex).toBe(1);
		expect(sleeps).toEqual([]);
	});

	it("returns the last 500 response after exhausting retries", async () => {
		const sleeps: number[] = [];
		let callIndex = 0;
		const policy = createRetryPolicy(sleeps);

		const response = await policy.attemptFetch(async (): Promise<Response> => {
			callIndex += 1;
			return createTextResponse(`server error ${callIndex}`, 500);
		});

		expect(response.status).toBe(500);
		expect(callIndex).toBe(3);
		expect(sleeps).toEqual([500, 1000]);
	});

	it("rethrows the last network error after exhausting retries", async () => {
		const sleeps: number[] = [];
		let callIndex = 0;
		const policy = createRetryPolicy(sleeps);

		await expect(
			policy.attemptFetch(async (): Promise<Response> => {
				callIndex += 1;
				throw new Error(`network ${callIndex}`);
			}),
		).rejects.toThrow("network 3");
		expect(callIndex).toBe(3);
		expect(sleeps).toEqual([500, 1000]);
	});
});
