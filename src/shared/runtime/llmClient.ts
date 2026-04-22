import type { TranslateParagraphInput } from "@/shared/llm/types";
import {
	LLM_TRANSLATE_PARAGRAPH_MESSAGE_TYPE,
	LLM_TRANSLATION_CACHE_CLEAR_MESSAGE_TYPE,
	type LlmTranslateParagraphRequest,
	type LlmTranslateParagraphResponse,
	LlmTranslateParagraphResponseSchema,
	type LlmTranslationCacheClearRequest,
	type LlmTranslationCacheClearResponse,
	LlmTranslationCacheClearResponseSchema,
} from "@/shared/runtime/messages/llmMessages";
import { createMessageClient } from "@/shared/runtime/sendTypedMessage";

const sendTranslateParagraphRequest = createMessageClient<
	LlmTranslateParagraphRequest,
	LlmTranslateParagraphResponse
>({
	responseSchema: LlmTranslateParagraphResponseSchema,
	type: LLM_TRANSLATE_PARAGRAPH_MESSAGE_TYPE,
});

const sendTranslationCacheClearRequest = createMessageClient<
	LlmTranslationCacheClearRequest,
	LlmTranslationCacheClearResponse
>({
	responseSchema: LlmTranslationCacheClearResponseSchema,
	type: LLM_TRANSLATION_CACHE_CLEAR_MESSAGE_TYPE,
});

export async function requestTranslateParagraph(
	input: TranslateParagraphInput,
): Promise<LlmTranslateParagraphResponse> {
	return await sendTranslateParagraphRequest({ input: input });
}

export async function requestTranslationCacheClear(): Promise<LlmTranslationCacheClearResponse> {
	return await sendTranslationCacheClearRequest();
}
