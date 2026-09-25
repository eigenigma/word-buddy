import type { TranslationCacheService } from "@/background/translations/service";
import type {
	TranslateParagraphInput,
	TranslateParagraphResult,
} from "@/shared/llm/types";
import { isSettingsComplete, type LlmSettings } from "@/shared/settings/types";

import type { OpenAiCompatibleClient } from "./openaiClient";

export interface ParagraphTranslatorDependencies {
	readonly cache: TranslationCacheService;
	readonly client: OpenAiCompatibleClient;
	readonly clock: () => number;
	// Must ignore word order, so reordered requests share one cache entry.
	readonly computeHash: (
		model: string,
		paragraph: string,
		words: readonly string[],
	) => Promise<string>;
	readonly getSettings: () => Promise<LlmSettings>;
}

export interface ParagraphTranslator {
	readonly translateParagraph: (
		input: TranslateParagraphInput,
	) => Promise<TranslateParagraphResult>;
}

export function createParagraphTranslator(
	dependencies: ParagraphTranslatorDependencies,
): ParagraphTranslator {
	return {
		translateParagraph: async (
			input: TranslateParagraphInput,
		): Promise<TranslateParagraphResult> => {
			const settings = await dependencies.getSettings();
			if (!isSettingsComplete(settings)) {
				throw new Error("LLM settings incomplete");
			}
			const hash = await dependencies.computeHash(
				settings.model,
				input.paragraph,
				input.words,
			);
			const cachedEntry = await dependencies.cache.get(hash);

			if (cachedEntry !== null) {
				return {
					cached: true,
					translations: cachedEntry.translations,
				};
			}

			const translations = await dependencies.client.translateParagraph(input);
			await dependencies.cache.set({
				createdAt: dependencies.clock(),
				hash: hash,
				model: settings.model,
				paragraph: input.paragraph,
				translations: translations,
				words: input.words,
			});

			return {
				cached: false,
				translations: translations,
			};
		},
	};
}
