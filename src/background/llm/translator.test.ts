import { afterEach, assert, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import type { LlmSettings } from "../../shared/settings/types";
import {
	createJsonResponse,
	createTextResponse,
	createTranslatorHarness,
	deleteWordBuddyDatabase,
	type TranslatorHarness,
} from "../../test-helpers/llmHarness";

const BASE_SETTINGS: LlmSettings = {
	apiKey: "sk-test",
	endpoint: "https://test.example/v1/chat/completions",
	model: "fake-model",
};

const SINGLE_WORD_INPUT = {
	paragraph: "What is on the agenda today?",
	words: ["agenda"],
} as const;

const MULTI_WORD_INPUT = {
	paragraph: "What is on the agenda today?",
	words: ["agenda", "today"],
} as const;

interface HappyPathFetcherState {
	readonly requestBodies: unknown[];
	readonly settingsRef: { current: LlmSettings };
	readonly totalCalls: { current: number };
}

const RequestBodySchema = z.looseObject({
	messages: z.array(z.looseObject({ content: z.string().optional() })),
});

function extractRequestBody(
	init?: RequestInit,
): z.output<typeof RequestBodySchema> {
	return RequestBodySchema.parse(JSON.parse(String(init?.body ?? "{}")));
}

function createHappyPathFetcher(state: HappyPathFetcherState): typeof fetch {
	return async (
		input: RequestInfo | URL,
		init?: RequestInit,
	): Promise<Response> => {
		state.totalCalls.current += 1;
		assert(
			String(input) === state.settingsRef.current.endpoint,
			`fetch should target configured endpoint, got ${String(input)}`,
		);

		const headers = new Headers(init?.headers);
		assert(
			headers.get("Authorization") ===
				`Bearer ${state.settingsRef.current.apiKey}`,
			"fetch should send bearer token",
		);
		assert(
			headers.get("Content-Type") === "application/json",
			"fetch should send JSON content type",
		);

		const body = extractRequestBody(init);
		state.requestBodies.push(body);
		assert(
			body["model"] === state.settingsRef.current.model,
			"request should include model",
		);
		assert(
			JSON.stringify(body["response_format"]) ===
				JSON.stringify({ type: "json_object" }),
			"request should enable json_object mode",
		);

		if (body.messages[1]?.content?.includes('"today"')) {
			return createJsonResponse({
				choices: [
					{
						message: {
							content: JSON.stringify({ agenda: "议程", today: "今天" }),
						},
					},
				],
			});
		}

		return createJsonResponse({
			choices: [{ message: { content: JSON.stringify({ agenda: "议程" }) } }],
		});
	};
}

let harnesses: TranslatorHarness[] = [];

function trackHarness(
	dependencies: Parameters<typeof createTranslatorHarness>[0],
): TranslatorHarness {
	const harness = createTranslatorHarness(dependencies);
	harnesses.push(harness);
	return harness;
}

function createHappyPathHarness(): {
	readonly harness: TranslatorHarness;
	readonly requestBodies: unknown[];
	readonly settingsRef: { current: LlmSettings };
	readonly totalCalls: { current: number };
} {
	const settingsRef = { current: { ...BASE_SETTINGS } };
	const requestBodies: unknown[] = [];
	const totalCalls = { current: 0 };

	return {
		harness: trackHarness({
			fetcher: createHappyPathFetcher({
				requestBodies: requestBodies,
				settingsRef: settingsRef,
				totalCalls: totalCalls,
			}),
			settingsRef: settingsRef,
		}),
		requestBodies: requestBodies,
		settingsRef: settingsRef,
		totalCalls: totalCalls,
	};
}

function createFailureHarness(fetcher: typeof fetch): TranslatorHarness {
	return trackHarness({
		fetcher: fetcher,
		settingsRef: { current: { ...BASE_SETTINGS } },
	});
}

beforeEach(async (): Promise<void> => {
	harnesses = [];
	await deleteWordBuddyDatabase();
});

afterEach(async (): Promise<void> => {
	for (const harness of harnesses) {
		harness.database.close();
	}
	await deleteWordBuddyDatabase();
});

describe("createParagraphTranslator cache hits", () => {
	it("caches repeated single-word requests", async (): Promise<void> => {
		const { harness, totalCalls } = createHappyPathHarness();

		const firstResult =
			await harness.translator.translateParagraph(SINGLE_WORD_INPUT);
		expect(firstResult.cached).toBe(false);
		expect(firstResult.translations["agenda"]).toBe("议程");
		expect(totalCalls.current).toBe(1);

		const secondResult =
			await harness.translator.translateParagraph(SINGLE_WORD_INPUT);
		expect(secondResult.cached).toBe(true);
		expect(secondResult.translations["agenda"]).toBe("议程");
		expect(totalCalls.current).toBe(1);
	});

	it("reuses the multi-word cache entry when the word order changes", async (): Promise<void> => {
		const { harness, totalCalls } = createHappyPathHarness();

		await harness.translator.translateParagraph(SINGLE_WORD_INPUT);
		const firstResult =
			await harness.translator.translateParagraph(MULTI_WORD_INPUT);
		expect(firstResult.cached).toBe(false);
		expect(firstResult.translations).toEqual({
			agenda: "议程",
			today: "今天",
		});
		expect(totalCalls.current).toBe(2);

		const secondResult = await harness.translator.translateParagraph({
			paragraph: MULTI_WORD_INPUT.paragraph,
			words: ["today", "agenda"],
		});
		expect(secondResult.cached).toBe(true);
		expect(totalCalls.current).toBe(2);
	});
});

describe("createParagraphTranslator cache invalidation", () => {
	it("invalidates the cache when the configured model changes", async (): Promise<void> => {
		const { harness, requestBodies, settingsRef, totalCalls } =
			createHappyPathHarness();

		await harness.translator.translateParagraph(SINGLE_WORD_INPUT);
		await harness.translator.translateParagraph(MULTI_WORD_INPUT);
		settingsRef.current = {
			...settingsRef.current,
			model: "fake-model-2",
		};

		const result =
			await harness.translator.translateParagraph(SINGLE_WORD_INPUT);
		expect(result.cached).toBe(false);
		expect(totalCalls.current).toBe(3);
		expect(requestBodies).toHaveLength(3);
	});
});

describe("createParagraphTranslator retry behavior", () => {
	it("populates cache after the retry policy retries a 429 response", async (): Promise<void> => {
		const settingsRef = { current: { ...BASE_SETTINGS } };
		const totalCalls = { current: 0 };
		const harness = trackHarness({
			fetcher: async (): Promise<Response> => {
				totalCalls.current += 1;
				return totalCalls.current === 1
					? createTextResponse("retry later", 429)
					: createJsonResponse({
							choices: [
								{
									message: {
										content: JSON.stringify({ agenda: "议程" }),
									},
								},
							],
						});
			},
			retryPolicy: {
				attemptFetch: async (
					request: () => Promise<Response>,
				): Promise<Response> => {
					const firstResponse = await request();
					return firstResponse.status === 429 ? await request() : firstResponse;
				},
			},
			settingsRef: settingsRef,
		});

		const firstResult =
			await harness.translator.translateParagraph(SINGLE_WORD_INPUT);
		expect(firstResult.cached).toBe(false);
		expect(firstResult.translations["agenda"]).toBe("议程");

		const secondResult =
			await harness.translator.translateParagraph(SINGLE_WORD_INPUT);
		expect(secondResult.cached).toBe(true);
		expect(totalCalls.current).toBe(2);
	});
});

describe("createParagraphTranslator settings validation", () => {
	it("throws before fetching when settings become incomplete after a cache write", async (): Promise<void> => {
		const { harness, settingsRef, totalCalls } = createHappyPathHarness();

		const coldResult =
			await harness.translator.translateParagraph(SINGLE_WORD_INPUT);
		expect(coldResult.cached).toBe(false);
		expect(totalCalls.current).toBe(1);

		settingsRef.current = {
			...settingsRef.current,
			apiKey: "",
		};

		await expect(
			harness.translator.translateParagraph(SINGLE_WORD_INPUT),
		).rejects.toThrow("LLM settings incomplete");
		expect(totalCalls.current).toBe(1);
	});
});

describe("createParagraphTranslator failure paths", () => {
	it("does not poison the cache on 401 responses", async (): Promise<void> => {
		const totalCalls = { current: 0 };
		const harness = createFailureHarness(async (): Promise<Response> => {
			totalCalls.current += 1;
			return createTextResponse("unauthorized", 401);
		});

		await expect(
			harness.translator.translateParagraph(SINGLE_WORD_INPUT),
		).rejects.toThrow();
		await expect(
			harness.translator.translateParagraph(SINGLE_WORD_INPUT),
		).rejects.toThrow();
		expect(await harness.database.translations.count()).toBe(0);
		expect(totalCalls.current).toBe(2);
	});

	it("does not poison the cache on invalid JSON content", async (): Promise<void> => {
		const totalCalls = { current: 0 };
		const harness = createFailureHarness(async (): Promise<Response> => {
			totalCalls.current += 1;
			return createJsonResponse({
				choices: [{ message: { content: "not json" } }],
			});
		});

		await expect(
			harness.translator.translateParagraph(SINGLE_WORD_INPUT),
		).rejects.toThrow();
		await expect(
			harness.translator.translateParagraph(SINGLE_WORD_INPUT),
		).rejects.toThrow();
		expect(await harness.database.translations.count()).toBe(0);
		expect(totalCalls.current).toBe(2);
	});

	it("does not poison the cache when the response omits a requested key", async (): Promise<void> => {
		const totalCalls = { current: 0 };
		const harness = createFailureHarness(async (): Promise<Response> => {
			totalCalls.current += 1;
			return createJsonResponse({
				choices: [
					{
						message: {
							content: JSON.stringify({ missing: "缺失" }),
						},
					},
				],
			});
		});

		await expect(
			harness.translator.translateParagraph(SINGLE_WORD_INPUT),
		).rejects.toThrow();
		await expect(
			harness.translator.translateParagraph(SINGLE_WORD_INPUT),
		).rejects.toThrow();
		expect(await harness.database.translations.count()).toBe(0);
		expect(totalCalls.current).toBe(2);
	});
});
