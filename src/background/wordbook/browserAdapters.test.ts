import { assert, beforeEach, describe, expect, it, vi } from "vitest";

import type { WordbookServiceDependencies } from "@/background/wordbook/service";
import type { WordbookEntry } from "@/shared/wordbook/types";

import { createWordbookBrowserAdapter } from "./browserAdapters";

const {
	WORDBOOK_SERVICE,
	createWordbookServiceMock,
	wordbookListAllMock,
	userDbMock,
} = vi.hoisted(() => {
	const listAllMock = vi.fn();
	return {
		WORDBOOK_SERVICE: { id: "wordbook" },
		createWordbookServiceMock:
			vi.fn<(dependencies: WordbookServiceDependencies) => unknown>(),
		wordbookListAllMock: listAllMock,
		userDbMock: {
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

vi.mock("@/background/wordbook/database", () => ({
	userDb: userDbMock,
}));
vi.mock("@/background/wordbook/service", () => ({
	createWordbookService: createWordbookServiceMock,
}));

const TEST_WORDBOOK_ENTRY: WordbookEntry = {
	addedAt: 1,
	context: "agenda context",
	lemma: "agenda",
	original: "agenda",
	sourceUrl: "https://example.com/article",
};

beforeEach(() => {
	vi.resetAllMocks();
	createWordbookServiceMock.mockReturnValue(WORDBOOK_SERVICE);
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
