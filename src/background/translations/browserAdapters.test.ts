import { assert, beforeEach, describe, expect, it, vi } from "vitest";

import type { TranslationCacheServiceDependencies } from "@/background/translations/service";
import type { TranslationCacheEntry } from "@/shared/translations/types";

import { createTranslationCacheBrowserAdapter } from "./browserAdapters";

const {
	TRANSLATION_CACHE_SERVICE,
	browserTabsQueryMock,
	browserTabsSendMessageMock,
	createAnnotatorBroadcasterMock,
	createTranslationCacheServiceMock,
	createWordbookServiceMock,
	wordbookListAllMock,
	userDbMock,
} = vi.hoisted(() => {
	const listAllMock = vi.fn();
	return {
		TRANSLATION_CACHE_SERVICE: { id: "translation-cache" },
		browserTabsQueryMock: vi.fn(),
		browserTabsSendMessageMock: vi.fn(),
		createAnnotatorBroadcasterMock: vi.fn(),
		createTranslationCacheServiceMock:
			vi.fn<(dependencies: TranslationCacheServiceDependencies) => unknown>(),
		createWordbookServiceMock: vi.fn(),
		wordbookListAllMock: listAllMock,
		userDbMock: {
			translations: {
				clear: vi.fn(),
				count: vi.fn(),
				get: vi.fn(),
				put: vi.fn(),
			},
			words: {
				delete: vi.fn(),
				get: vi.fn(),
				orderBy: vi.fn(() => ({
					reverse: (): { readonly toArray: typeof listAllMock } => ({
						toArray: listAllMock,
					}),
				})),
				put: vi.fn(),
				update: vi.fn(),
			},
		},
	};
});

vi.mock("@/background/annotator/broadcaster", () => ({
	createAnnotatorBroadcaster: createAnnotatorBroadcasterMock,
}));
vi.mock("@/background/dictionary/assets", () => ({
	loadDictionarySeedAssets: vi.fn(),
	loadDictionarySeedManifest: vi.fn(),
}));
vi.mock("@/background/dictionary/database", () => ({
	STATIC_DICTIONARY_DB_SCHEMA_VERSION: 1,
	staticDictionaryDb: {
		dict: { bulkPut: vi.fn(), clear: vi.fn(), count: vi.fn(), get: vi.fn() },
		lemma: {
			bulkPut: vi.fn(),
			clear: vi.fn(),
			count: vi.fn(),
			get: vi.fn(),
			toArray: vi.fn(),
		},
		transaction: vi.fn(async (...args: unknown[]): Promise<unknown> => {
			const callback = args.at(-1);
			return typeof callback === "function" ? await callback() : undefined;
		}),
	},
}));
vi.mock("@/background/dictionary/lemmaExpansionService", () => ({
	createLemmaExpansionService: (): object => ({ id: "lemma-expansion" }),
}));
vi.mock("@/background/dictionary/queryService", () => ({
	createDictionaryQueryService: (): object => ({ id: "dictionary-query" }),
}));
vi.mock("@/background/dictionary/seed", () => ({
	createBrowserDictionarySeedStateStorage: (): object => ({
		id: "seed-storage",
	}),
	createDictionarySeedService: (): object => ({ id: "dictionary-seed" }),
}));
vi.mock("@/background/llm/openaiClient", () => ({
	createOpenAiCompatibleClient: (): object => ({ id: "openai" }),
}));
vi.mock("@/background/llm/rateLimiter", () => ({
	createTokenBucketRateLimiter: (): object => ({ id: "rate-limiter" }),
}));
vi.mock("@/background/llm/retryPolicy", () => ({
	createExponentialRetryPolicy: (): object => ({ id: "retry-policy" }),
}));
vi.mock("@/background/llm/translator", () => ({
	createParagraphTranslator: (): object => ({ id: "paragraph-translator" }),
}));
vi.mock("@/background/settings/service", () => ({
	createSettingsService: (): object => ({ get: vi.fn(), set: vi.fn() }),
}));
vi.mock("@/background/settings/storage", () => ({
	createBrowserStorageSettingsStorage: (): object => ({
		id: "settings-storage",
	}),
}));
vi.mock("@/background/siteControl/service", () => ({
	createSiteControlService: (): object => ({ id: "site-control" }),
}));
vi.mock("@/background/siteControl/storage", () => ({
	createBrowserStorageSiteControl: (): object => ({
		id: "site-control-storage",
	}),
}));
vi.mock("@/background/translations/hash", () => ({
	computeTranslationHash: vi.fn(() => "hash"),
}));
vi.mock("@/background/translations/service", () => ({
	createTranslationCacheService: createTranslationCacheServiceMock,
}));
vi.mock("@/background/wordbook/database", () => ({
	userDb: userDbMock,
}));
vi.mock("@/background/wordbook/service", () => ({
	createWordbookService: createWordbookServiceMock,
}));
vi.mock("@/shared/utils/async", () => ({
	sleep: vi.fn(),
}));

const TEST_TRANSLATION_CACHE_ENTRY: TranslationCacheEntry = {
	createdAt: 1,
	hash: "hash",
	model: "gpt-4.1-mini",
	paragraph: "agenda paragraph",
	translations: {
		agenda: "议程",
	},
	words: ["agenda"],
};

function resetDatabaseMocks(): void {
	browserTabsQueryMock.mockReset();
	browserTabsSendMessageMock.mockReset();
	createAnnotatorBroadcasterMock.mockReset();
	createTranslationCacheServiceMock.mockReset();
	createWordbookServiceMock.mockReset();
	wordbookListAllMock.mockReset();
	userDbMock.translations.clear.mockReset();
	userDbMock.translations.count.mockReset();
	userDbMock.translations.get.mockReset();
	userDbMock.translations.put.mockReset();
	userDbMock.words.delete.mockReset();
	userDbMock.words.get.mockReset();
	userDbMock.words.orderBy.mockClear();
	userDbMock.words.put.mockReset();
	userDbMock.words.update.mockReset();
}

beforeEach(() => {
	resetDatabaseMocks();
	createTranslationCacheServiceMock.mockReturnValue(TRANSLATION_CACHE_SERVICE);
	vi.stubGlobal("browser", {
		tabs: {
			query: browserTabsQueryMock,
			sendMessage: browserTabsSendMessageMock,
		},
	});
});

describe("createTranslationCacheBrowserAdapter", () => {
	it("returns the translation cache service", () => {
		expect(createTranslationCacheBrowserAdapter()).toBe(
			TRANSLATION_CACHE_SERVICE,
		);
	});
});

describe("translation cache wiring", () => {
	it("routes translation cache repository calls through userDb.translations", async () => {
		userDbMock.translations.count.mockResolvedValue(3);
		userDbMock.translations.get.mockResolvedValue(TEST_TRANSLATION_CACHE_ENTRY);
		userDbMock.translations.put.mockResolvedValue("hash");
		createTranslationCacheBrowserAdapter();

		const dependencies = createTranslationCacheServiceMock.mock.lastCall?.[0];
		assert.isDefined(dependencies);

		await dependencies.repository.clearAll();
		await expect(dependencies.repository.count()).resolves.toBe(3);
		await expect(dependencies.repository.getByHash("hash")).resolves.toEqual(
			TEST_TRANSLATION_CACHE_ENTRY,
		);
		await dependencies.repository.putEntry(TEST_TRANSLATION_CACHE_ENTRY);
		expect(userDbMock.translations.clear).toHaveBeenCalledTimes(1);
		expect(userDbMock.translations.get).toHaveBeenCalledWith("hash");
		expect(userDbMock.translations.put).toHaveBeenCalledWith(
			TEST_TRANSLATION_CACHE_ENTRY,
		);
	});
});
