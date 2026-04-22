import { createOpenAiCompatibleClient } from "../background/llm/openaiClient";
import type { RateLimiter } from "../background/llm/rateLimiter";
import type { RetryPolicy } from "../background/llm/retryPolicy";
import {
	createParagraphTranslator,
	type ParagraphTranslator,
} from "../background/llm/translator";
import { computeTranslationHash } from "../background/translations/hash";
import {
	createTranslationCacheService,
	type TranslationRepository,
} from "../background/translations/service";
import {
	userDb,
	WORD_BUDDY_USER_DB_NAME,
	WordBuddyUserDatabase,
} from "../background/wordbook/database";
import type { LlmSettings } from "../shared/settings/types";
import type { TranslationCacheEntry } from "../shared/translations/types";

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

export async function deleteWordBuddyDatabase(): Promise<void> {
	userDb.close();

	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase(WORD_BUDDY_USER_DB_NAME);
		request.onsuccess = (): void => {
			resolve();
		};
		request.onerror = (): void => {
			reject(request.error ?? new Error("Failed to delete test database."));
		};
		request.onblocked = (): void => {
			reject(new Error("Deleting test database was blocked."));
		};
	});
}

export function createJsonResponse(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status: status,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

export function createTextResponse(body: string, status: number): Response {
	return new Response(body, {
		status: status,
		headers: {
			"Content-Type": "text/plain",
		},
	});
}

function createTranslationRepository(
	database: WordBuddyUserDatabase,
): TranslationRepository {
	return {
		clearAll: async (): Promise<void> => {
			await database.translations.clear();
		},
		count: async (): Promise<number> => await database.translations.count(),
		getByHash: async (hash: string) => await database.translations.get(hash),
		putEntry: async (entry: TranslationCacheEntry): Promise<string> =>
			await database.translations.put(entry),
	};
}

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
