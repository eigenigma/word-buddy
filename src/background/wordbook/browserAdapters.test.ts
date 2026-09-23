import { assert, beforeEach, describe, expect, it, vi } from "vitest";

import type { WordbookServiceDependencies } from "@/background/wordbook/service";
import type { WordbookEntry } from "@/shared/wordbook/types";

import { createWordbookBrowserAdapter } from "./browserAdapters";

const {
	WORDBOOK_SERVICE,
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
		WORDBOOK_SERVICE: { id: "wordbook" },
		browserTabsQueryMock: vi.fn(),
		browserTabsSendMessageMock: vi.fn(),
		createAnnotatorBroadcasterMock: vi.fn(),
		createTranslationCacheServiceMock: vi.fn(),
		createWordbookServiceMock:
			vi.fn<(dependencies: WordbookServiceDependencies) => unknown>(),
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

const TEST_WORDBOOK_ENTRY: WordbookEntry = {
	addedAt: 1,
	context: "agenda context",
	lemma: "agenda",
	original: "agenda",
	sourceUrl: "https://example.com/article",
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
	createWordbookServiceMock.mockReturnValue(WORDBOOK_SERVICE);
	vi.stubGlobal("browser", {
		tabs: {
			query: browserTabsQueryMock,
			sendMessage: browserTabsSendMessageMock,
		},
	});
});

describe("createWordbookBrowserAdapter", () => {
	it("returns the wordbook service", () => {
		expect(createWordbookBrowserAdapter()).toBe(WORDBOOK_SERVICE);
	});
});

describe("wordbook wiring", () => {
	it("routes wordbook repository calls through userDb.words", async () => {
		userDbMock.words.delete.mockResolvedValue(undefined);
		userDbMock.words.get.mockResolvedValue(TEST_WORDBOOK_ENTRY);
		wordbookListAllMock.mockResolvedValue([TEST_WORDBOOK_ENTRY]);
		userDbMock.words.put.mockResolvedValue("agenda");
		userDbMock.words.update.mockResolvedValue(1);
		createWordbookBrowserAdapter();

		const dependencies = createWordbookServiceMock.mock.lastCall?.[0];
		assert.isDefined(dependencies);

		await dependencies.repository.deleteByLemma("agenda");
		await expect(dependencies.repository.getByLemma("agenda")).resolves.toEqual(
			TEST_WORDBOOK_ENTRY,
		);
		await expect(dependencies.repository.listAll()).resolves.toEqual([
			TEST_WORDBOOK_ENTRY,
		]);
		await dependencies.repository.putWord(TEST_WORDBOOK_ENTRY);
		await dependencies.repository.updateByLemma("agenda", {
			original: "updated agenda",
		});
		expect(userDbMock.words.delete).toHaveBeenCalledWith("agenda");
		expect(userDbMock.words.get).toHaveBeenCalledWith("agenda");
		expect(userDbMock.words.orderBy).toHaveBeenCalledWith("addedAt");
		expect(userDbMock.words.put).toHaveBeenCalledWith(TEST_WORDBOOK_ENTRY);
		expect(userDbMock.words.update).toHaveBeenCalledWith("agenda", {
			original: "updated agenda",
		});
	});
});
