import { z } from "zod";

import type { TranslateParagraphInput } from "@/shared/llm/types";
import {
	NullableStringSchema,
	NumberSchema,
	ReadonlyStringArraySchema,
	ReadonlyStringRecordSchema,
} from "@/shared/utils/schemas";

const TranslateParagraphInputSchema: z.ZodType<TranslateParagraphInput> = z
	.object({
		paragraph: z.string(),
		words: ReadonlyStringArraySchema,
	})
	.readonly();

export const LLM_TRANSLATE_PARAGRAPH_MESSAGE_TYPE =
	"wordBuddy.llm.translateParagraph" as const;
export const LLM_TRANSLATION_CACHE_CLEAR_MESSAGE_TYPE =
	"wordBuddy.llm.translationCacheClear" as const;

export const LlmTranslateParagraphRequestSchema = z
	.object({
		input: TranslateParagraphInputSchema,
		type: z.literal(LLM_TRANSLATE_PARAGRAPH_MESSAGE_TYPE),
	})
	.readonly();
export type LlmTranslateParagraphRequest = z.infer<
	typeof LlmTranslateParagraphRequestSchema
>;

export const LlmTranslateParagraphResponseSchema = z
	.object({
		cached: z.boolean(),
		error: NullableStringSchema,
		translations: ReadonlyStringRecordSchema.nullable(),
	})
	.readonly();
export type LlmTranslateParagraphResponse = z.infer<
	typeof LlmTranslateParagraphResponseSchema
>;

export const LlmTranslationCacheClearRequestSchema = z
	.object({
		type: z.literal(LLM_TRANSLATION_CACHE_CLEAR_MESSAGE_TYPE),
	})
	.readonly();
export type LlmTranslationCacheClearRequest = z.infer<
	typeof LlmTranslationCacheClearRequestSchema
>;

export const LlmTranslationCacheClearResponseSchema = z
	.object({
		clearedCount: NumberSchema,
	})
	.readonly();
export type LlmTranslationCacheClearResponse = z.infer<
	typeof LlmTranslationCacheClearResponseSchema
>;
