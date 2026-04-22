import { describe, expect, it } from "vitest";

import {
	LLM_TRANSLATE_PARAGRAPH_MESSAGE_TYPE,
	LLM_TRANSLATION_CACHE_CLEAR_MESSAGE_TYPE,
	LlmTranslateParagraphRequestSchema,
	LlmTranslateParagraphResponseSchema,
	LlmTranslationCacheClearRequestSchema,
	LlmTranslationCacheClearResponseSchema,
} from "./llmMessages";

describe("llm message schemas", () => {
	it.each([
		[
			"translate paragraph request",
			LlmTranslateParagraphRequestSchema,
			{
				input: { paragraph: "What is on the agenda today?", words: ["agenda"] },
				type: LLM_TRANSLATE_PARAGRAPH_MESSAGE_TYPE,
			},
		],
		[
			"translate paragraph response",
			LlmTranslateParagraphResponseSchema,
			{ cached: false, error: null, translations: { agenda: "议程" } },
		],
		[
			"translation cache clear request",
			LlmTranslationCacheClearRequestSchema,
			{ type: LLM_TRANSLATION_CACHE_CLEAR_MESSAGE_TYPE },
		],
		[
			"translation cache clear response",
			LlmTranslationCacheClearResponseSchema,
			{ clearedCount: 1 },
		],
	])("accepts valid %s", (_name, schema, value) => {
		expect(schema.parse(value)).toEqual(value);
	});

	it.each([
		[
			"translate paragraph request",
			LlmTranslateParagraphRequestSchema,
			{
				input: { paragraph: "What is on the agenda today?", words: [1] },
				type: LLM_TRANSLATE_PARAGRAPH_MESSAGE_TYPE,
			},
		],
		[
			"translate paragraph response",
			LlmTranslateParagraphResponseSchema,
			{ cached: false, error: null, translations: { agenda: 1 } },
		],
		[
			"translation cache clear request",
			LlmTranslationCacheClearRequestSchema,
			{ type: LLM_TRANSLATE_PARAGRAPH_MESSAGE_TYPE },
		],
		[
			"translation cache clear response",
			LlmTranslationCacheClearResponseSchema,
			{ clearedCount: "1" },
		],
	])("rejects invalid %s", (_name, schema, value) => {
		expect(() => schema.parse(value)).toThrow();
	});
});
