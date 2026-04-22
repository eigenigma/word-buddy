import "fake-indexeddb/auto";

import { afterAll, afterEach, describe, expect, it } from "vitest";

import {
	STATIC_DICTIONARY_DB_NAME,
	StaticDictionaryDatabase,
	staticDictionaryDb,
} from "./database";
import { createLemmaExpansionService } from "./lemmaExpansionService";

const openDatabases = new Set<StaticDictionaryDatabase>();

function trackDatabase(
	database: StaticDictionaryDatabase,
): StaticDictionaryDatabase {
	openDatabases.add(database);
	return database;
}

function closeOpenDatabases(): void {
	staticDictionaryDb.close();
	for (const database of openDatabases) {
		database.close();
	}
	openDatabases.clear();
}

async function deleteIndexedDatabase(databaseName: string): Promise<void> {
	await new Promise<void>((resolve, reject) => {
		const request = indexedDB.deleteDatabase(databaseName);
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

async function deleteDictionaryDatabase(): Promise<void> {
	closeOpenDatabases();
	await deleteIndexedDatabase(STATIC_DICTIONARY_DB_NAME);
}

function sortExpansions(
	expansions: Readonly<Record<string, readonly string[]>>,
): Readonly<Record<string, readonly string[]>> {
	return Object.fromEntries(
		Object.entries(expansions).map(([lemma, surfaces]) => [
			lemma,
			[...surfaces].sort(),
		]),
	);
}

afterEach(async () => {
	await deleteDictionaryDatabase();
});

afterAll(async () => {
	await deleteDictionaryDatabase();
});

describe("createLemmaExpansionService", () => {
	it("expands lemmas from the reverse index and memoizes repository reads", async () => {
		await deleteDictionaryDatabase();
		const database = trackDatabase(new StaticDictionaryDatabase());
		await database.open();
		await database.lemma.bulkPut([
			{ lemma: "run", surface: "ran" },
			{ lemma: "run", surface: "running" },
			{ lemma: "run", surface: "runs" },
			{ lemma: "agenda", surface: "agendas" },
		]);

		let listAllCalls = 0;
		const service = createLemmaExpansionService({
			repository: {
				listAll: async () => {
					listAllCalls += 1;
					return await database.lemma.toArray();
				},
			},
		});

		expect(sortExpansions(await service.expandLemmas(["run"]))).toEqual({
			run: ["ran", "run", "running", "runs"],
		});
		expect(sortExpansions(await service.expandLemmas(["unknown"]))).toEqual({
			unknown: ["unknown"],
		});
		expect(listAllCalls).toBe(1);
	});

	it("returns an empty result for empty input without touching the repository", async () => {
		let listAllCalls = 0;
		const service = createLemmaExpansionService({
			repository: {
				listAll: async () => {
					listAllCalls += 1;
					return [];
				},
			},
		});

		expect(await service.expandLemmas([])).toEqual({});
		expect(listAllCalls).toBe(0);
	});
});
