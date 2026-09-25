import { createOpenAiCompatibleClient } from "../background/llm/openaiClient";
import type { RateLimiter } from "../background/llm/rateLimiter";
import type { RetryPolicy } from "../background/llm/retryPolicy";
import {
	createParagraphTranslator,
	type ParagraphTranslator,
} from "../background/llm/translator";
import { createTranslationRepository } from "../background/translations/browserAdapters";
import { computeTranslationHash } from "../background/translations/hash";
import { createTranslationCacheService } from "../background/translations/service";
import { WordBuddyUserDatabase } from "../background/wordbook/database";
import type { LlmSettings } from "../shared/settings/types";

export interface TranslatorHarness {
	readonly database: WordBuddyUserDatabase;
	readonly translator: ParagraphTranslator;
}

export interface LlmHarnessDependencies {
	readonly fetcher: typeof fetch;
	readonly rateLimiter?: RateLimiter;
	readonly retryPolicy?: RetryPolicy;
	readonly settingsRef: { current: LlmSettings };
}

const IMMEDIATE_RATE_LIMITER: RateLimiter = {
	acquire: async (): Promise<void> => undefined,
};

const PASS_THROUGH_RETRY_POLICY: RetryPolicy = {
	attemptFetch: async (request: () => Promise<Response>): Promise<Response> =>
		await request(),
};

export function createTranslatorHarness(
	dependencies: LlmHarnessDependencies,
): TranslatorHarness {
	const database = new WordBuddyUserDatabase();
	const cache = createTranslationCacheService({
		repository: createTranslationRepository(database),
	});
	const client = createOpenAiCompatibleClient({
		fetcher: dependencies.fetcher,
		getSettings: async (): Promise<LlmSettings> =>
			dependencies.settingsRef.current,
		rateLimiter: dependencies.rateLimiter ?? IMMEDIATE_RATE_LIMITER,
		retryPolicy: dependencies.retryPolicy ?? PASS_THROUGH_RETRY_POLICY,
	});
	const translator = createParagraphTranslator({
		cache: cache,
		client: client,
		clock: (): number => 1_700_000_000_000,
		computeHash: computeTranslationHash,
		getSettings: async (): Promise<LlmSettings> =>
			dependencies.settingsRef.current,
	});

	return {
		database: database,
		translator: translator,
	};
}
