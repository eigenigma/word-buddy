import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";

import { createWordbookBrowserAdapter } from "./browserAdapters";
import { userDb } from "./database";

const TEST_ENTRY = {
	addedAt: 1_700_000_000_000,
	context: "There is no smoke without fire.",
	lemma: "smoke",
	original: "smoke",
	sourceUrl: "https://example.com/article",
} as const;

const OLDER_ENTRY = {
	addedAt: 1_700_000_000_100,
	context: null,
	lemma: "alpha",
	original: "alpha",
	sourceUrl: null,
} as const;

const NEWER_ENTRY = {
	addedAt: 1_700_000_000_200,
	context: null,
	lemma: "beta",
	original: "beta",
	sourceUrl: null,
} as const;

beforeEach(async () => {
	await userDb.words.clear();
});

afterEach(async () => {
	await userDb.words.clear();
});

afterAll(() => {
	userDb.close();
});

describe("createWordbookService", () => {
	it("adds, deduplicates, checks existence, removes entries, and empties the list", async () => {
		const service = createWordbookBrowserAdapter();

		await expect(service.addWord(TEST_ENTRY)).resolves.toEqual({ added: true });
		await expect(service.addWord(TEST_ENTRY)).resolves.toEqual({
			added: false,
		});
		await expect(service.existsByLemma(TEST_ENTRY.lemma)).resolves.toBe(true);
		await expect(service.removeByLemma("missing")).resolves.toEqual({
			removed: false,
		});
		await expect(service.removeByLemma(TEST_ENTRY.lemma)).resolves.toEqual({
			removed: true,
		});
		await expect(service.existsByLemma(TEST_ENTRY.lemma)).resolves.toBe(false);
		await expect(service.listAll()).resolves.toEqual([]);
	});

	it("lists all entries in descending addedAt order", async () => {
		const service = createWordbookBrowserAdapter();

		await service.addWord(OLDER_ENTRY);
		await service.addWord(NEWER_ENTRY);

		await expect(service.listAll()).resolves.toEqual([
			NEWER_ENTRY,
			OLDER_ENTRY,
		]);
	});

	it("updates existing entries and no-ops for missing lemmas", async () => {
		const service = createWordbookBrowserAdapter();

		await service.addWord(TEST_ENTRY);
		await expect(
			service.updateEntry(TEST_ENTRY.lemma, { context: "new context" }),
		).resolves.toEqual({
			entry: {
				...TEST_ENTRY,
				context: "new context",
			},
			updated: true,
		});
		await expect(
			service.updateEntry("missing", { original: "x" }),
		).resolves.toEqual({
			entry: null,
			updated: false,
		});
		await expect(
			service.updateEntry(TEST_ENTRY.lemma, { original: "revised" }),
		).resolves.toEqual({
			entry: {
				...TEST_ENTRY,
				context: "new context",
				original: "revised",
			},
			updated: true,
		});
		await expect(service.listAll()).resolves.toEqual([
			{
				...TEST_ENTRY,
				context: "new context",
				original: "revised",
			},
		]);
	});
});
