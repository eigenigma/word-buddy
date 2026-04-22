import type { BackgroundServices } from "@/background/composition";
import {
	type LlmTranslateParagraphRequest,
	LlmTranslateParagraphRequestSchema,
	type LlmTranslateParagraphResponse,
	type LlmTranslationCacheClearRequest,
	LlmTranslationCacheClearRequestSchema,
	type LlmTranslationCacheClearResponse,
} from "@/shared/runtime/messages/index";

import type { HandlerDescriptor } from "../routerCore";
import { withErrorEnvelope } from "../routerCore";

const translateParagraphHandler: HandlerDescriptor<
	LlmTranslateParagraphRequest,
	LlmTranslateParagraphResponse
> = {
	handle: async (
		services: BackgroundServices,
		request: LlmTranslateParagraphRequest,
	): Promise<LlmTranslateParagraphResponse> =>
		await withErrorEnvelope(
			async () =>
				await services.paragraphTranslator.translateParagraph(request.input),
			(result): LlmTranslateParagraphResponse => ({
				cached: result.cached,
				error: null,
				translations: result.translations,
			}),
			(errorMessage: string): LlmTranslateParagraphResponse => ({
				cached: false,
				error: errorMessage,
				translations: null,
			}),
		),
	requestSchema: LlmTranslateParagraphRequestSchema,
};

const translationCacheClearHandler: HandlerDescriptor<
	LlmTranslationCacheClearRequest,
	LlmTranslationCacheClearResponse
> = {
	handle: async (
		services: BackgroundServices,
		_request: LlmTranslationCacheClearRequest,
	): Promise<LlmTranslationCacheClearResponse> => ({
		clearedCount: await services.translationCacheService.clear(),
	}),
	requestSchema: LlmTranslationCacheClearRequestSchema,
};

export const llmHandlerDescriptors = [
	translateParagraphHandler,
	translationCacheClearHandler,
] as const;
