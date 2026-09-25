import { assert, beforeEach, describe, expect, it, vi } from "vitest";

import type { TranslationCacheServiceDependencies } from "@/background/translations/service";
import type { TranslationCacheEntry } from "@/shared/translations/types";

import { createTranslationCacheBrowserAdapter } from "./browserAdapters";

const {
	TRANSLATION_CACHE_SERVICE,
	createTranslationCacheServiceMock,
	userDbMock,
} = vi.hoisted(() => ({
	TRANSLATION_CACHE_SERVICE: { id: "translation-cache" },
	createTranslationCacheServiceMock:
		vi.fn<(dependencies: TranslationCacheServiceDependencies) => unknown>(),
	userDbMock: {
		translations: {
			clear: vi.fn(),
			count: vi.fn(),
			get: vi.fn(),
			put: vi.fn(),
		},
	},
}));

vi.mock("@/background/translations/service", () => ({
	createTranslationCacheService: createTranslationCacheServiceMock,
}));
vi.mock("@/background/wordbook/database", () => ({
	userDb: userDbMock,
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

beforeEach(() => {
	vi.resetAllMocks();
	createTranslationCacheServiceMock.mockReturnValue(TRANSLATION_CACHE_SERVICE);
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
