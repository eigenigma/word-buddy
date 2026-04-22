import {
	createOpenAiCompatibleClient,
	type OpenAiCompatibleClient,
} from "@/background/llm/openaiClient";
import { createTokenBucketRateLimiter } from "@/background/llm/rateLimiter";
import { createExponentialRetryPolicy } from "@/background/llm/retryPolicy";
import {
	createParagraphTranslator,
	type ParagraphTranslator,
} from "@/background/llm/translator";
import {
	createSettingsService,
	type SettingsService,
} from "@/background/settings/service";
import { createBrowserStorageSettingsStorage } from "@/background/settings/storage";
import {
	createSiteControlService,
	type SiteControlService,
} from "@/background/siteControl/service";
import { createBrowserStorageSiteControl } from "@/background/siteControl/storage";
import { computeTranslationHash } from "@/background/translations/hash";
import type { TranslationCacheService } from "@/background/translations/service";
import { LLM_CONFIG } from "@/shared/llm/config";
import { sleep } from "@/shared/utils/async";

export interface LlmBrowserAdapterDependencies {
	readonly translationCacheService: TranslationCacheService;
}

export interface LlmBrowserAdapter {
	readonly paragraphTranslator: ParagraphTranslator;
	readonly settingsService: SettingsService;
	readonly siteControlService: SiteControlService;
	readonly translationCacheService: TranslationCacheService;
}

function createOpenAiBrowserAdapter(
	settingsService: SettingsService,
): OpenAiCompatibleClient {
	const rateLimiter = createTokenBucketRateLimiter({
		capacity: LLM_CONFIG.rateLimitCapacity,
		now: Date.now,
		refillPerSecond: LLM_CONFIG.rateLimitRefillPerSecond,
		sleep: sleep,
	});
	const retryPolicy = createExponentialRetryPolicy({
		baseDelayMs: LLM_CONFIG.retryBaseDelayMs,
		maxAttempts: LLM_CONFIG.retryMaxAttempts,
		maxDelayMs: LLM_CONFIG.retryMaxDelayMs,
		now: Date.now,
		random: Math.random,
		sleep: sleep,
	});

	return createOpenAiCompatibleClient({
		fetcher: fetch.bind(globalThis),
		getSettings: () => settingsService.get(),
		rateLimiter: rateLimiter,
		retryPolicy: retryPolicy,
	});
}

export function createLlmBrowserAdapter(
	dependencies: LlmBrowserAdapterDependencies,
): LlmBrowserAdapter {
	const settingsService = createSettingsService({
		storage: createBrowserStorageSettingsStorage(),
	});
	const siteControlService = createSiteControlService({
		storage: createBrowserStorageSiteControl(),
	});
	const translationCacheService = dependencies.translationCacheService;
	const openAiClient = createOpenAiBrowserAdapter(settingsService);
	const paragraphTranslator = createParagraphTranslator({
		cache: translationCacheService,
		client: openAiClient,
		clock: Date.now,
		computeHash: computeTranslationHash,
		getSettings: () => settingsService.get(),
	});

	return {
		paragraphTranslator: paragraphTranslator,
		settingsService: settingsService,
		siteControlService: siteControlService,
		translationCacheService: translationCacheService,
	};
}
