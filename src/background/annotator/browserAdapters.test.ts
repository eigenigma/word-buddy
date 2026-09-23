import { assert, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnnotatorBroadcasterDependencies } from "@/background/annotator/broadcaster";

import { createAnnotatorBrowserAdapter } from "./browserAdapters";

const {
	ANNOTATOR_BROADCASTER,
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
		ANNOTATOR_BROADCASTER: { id: "annotator" },
		browserTabsQueryMock: vi.fn(),
		browserTabsSendMessageMock: vi.fn(),
		createAnnotatorBroadcasterMock:
			vi.fn<(dependencies: AnnotatorBroadcasterDependencies) => unknown>(),
		createTranslationCacheServiceMock: vi.fn(),
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
	createAnnotatorBroadcasterMock.mockReturnValue(ANNOTATOR_BROADCASTER);
	vi.stubGlobal("browser", {
		tabs: {
			query: browserTabsQueryMock,
			sendMessage: browserTabsSendMessageMock,
		},
	});
});

describe("createAnnotatorBrowserAdapter", () => {
	it("returns the annotator broadcaster", () => {
		expect(createAnnotatorBrowserAdapter()).toBe(ANNOTATOR_BROADCASTER);
	});
});

describe("annotator broadcaster wiring", () => {
	it("routes tab helpers through browser.tabs", async () => {
		browserTabsQueryMock.mockResolvedValue([{ id: 1 }, { id: undefined }]);
		createAnnotatorBrowserAdapter();

		const dependencies = createAnnotatorBroadcasterMock.mock.lastCall?.[0];
		assert.isDefined(dependencies);

		await expect(dependencies.tabs.queryAll()).resolves.toEqual([{ id: 1 }]);
		await dependencies.tabs.sendToTab(1, { type: "ping" });
		expect(browserTabsQueryMock).toHaveBeenCalledWith({
			url: ["http://*/*", "https://*/*"],
		});
		expect(browserTabsSendMessageMock).toHaveBeenCalledWith(1, {
			type: "ping",
		});
	});
});
