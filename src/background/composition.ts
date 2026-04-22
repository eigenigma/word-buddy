import type { AnnotatorBroadcaster } from "@/background/annotator/broadcaster";
import { createAnnotatorBrowserAdapter } from "@/background/annotator/browserAdapters";
import { createDictionaryBrowserAdapter } from "@/background/dictionary/browserAdapters";
import type { LemmaExpansionService } from "@/background/dictionary/lemmaExpansionService";
import type { DictionaryQueryService } from "@/background/dictionary/queryService";
import type { DictionarySeedService } from "@/background/dictionary/seed";
import { createLlmBrowserAdapter } from "@/background/llm/browserAdapters";
import type { ParagraphTranslator } from "@/background/llm/translator";
import type { SettingsService } from "@/background/settings/service";
import type { SiteControlService } from "@/background/siteControl/service";
import { createTranslationCacheBrowserAdapter } from "@/background/translations/browserAdapters";
import type { TranslationCacheService } from "@/background/translations/service";
import { createWordbookBrowserAdapter } from "@/background/wordbook/browserAdapters";
import type { WordbookService } from "@/background/wordbook/service";

export interface BackgroundServices {
	readonly annotatorBroadcaster: AnnotatorBroadcaster;
	readonly dictionaryQueryService: DictionaryQueryService;
	readonly dictionarySeedService: DictionarySeedService;
	readonly lemmaExpansionService: LemmaExpansionService;
	readonly paragraphTranslator: ParagraphTranslator;
	readonly settingsService: SettingsService;
	readonly siteControlService: SiteControlService;
	readonly translationCacheService: TranslationCacheService;
	readonly wordbookService: WordbookService;
}

export function createBackgroundServices(): BackgroundServices {
	const annotatorBroadcaster = createAnnotatorBrowserAdapter();
	const {
		dictionaryQueryService,
		dictionarySeedService,
		lemmaExpansionService,
	} = createDictionaryBrowserAdapter();
	const {
		paragraphTranslator,
		settingsService,
		siteControlService,
		translationCacheService,
	} = createLlmBrowserAdapter({
		translationCacheService: createTranslationCacheBrowserAdapter(),
	});
	const wordbookService = createWordbookBrowserAdapter();

	return {
		annotatorBroadcaster: annotatorBroadcaster,
		dictionaryQueryService: dictionaryQueryService,
		dictionarySeedService: dictionarySeedService,
		lemmaExpansionService: lemmaExpansionService,
		paragraphTranslator: paragraphTranslator,
		settingsService: settingsService,
		siteControlService: siteControlService,
		translationCacheService: translationCacheService,
		wordbookService: wordbookService,
	};
}
