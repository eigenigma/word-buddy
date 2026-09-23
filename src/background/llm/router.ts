import type { BackgroundServices } from "@/background/composition";
import {
	type LlmTranslateParagraphRequest,
	LlmTranslateParagraphRequestSchema,
	type LlmTranslateParagraphResponse,
	LlmTranslationCacheClearRequestSchema,
	type LlmTranslationCacheClearResponse,
} from "@/shared/runtime/messages/index";
import {
	defineMessageHandler,
	type MessageHandler,
	withErrorEnvelope,
} from "../routerCore";

const translateParagraphHandler = defineMessageHandler({
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
});

const translationCacheClearHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
	): Promise<LlmTranslationCacheClearResponse> => ({
		clearedCount: await services.translationCacheService.clear(),
	}),
	requestSchema: LlmTranslationCacheClearRequestSchema,
});

export const llmMessageHandlers: readonly MessageHandler[] = [
	translateParagraphHandler,
	translationCacheClearHandler,
];
