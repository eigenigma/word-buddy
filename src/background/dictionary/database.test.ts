import Dexie from "dexie";
import { afterEach, describe, expect, it } from "vitest";

import {
	STATIC_DICTIONARY_DB_NAME,
	StaticDictionaryDatabase,
} from "./database";

afterEach(async () => {
	await Dexie.delete(STATIC_DICTIONARY_DB_NAME);
});

describe("StaticDictionaryDatabase", () => {
	it("indexes rows written under schema version 1 by lemma", async () => {
		const versionOneDatabase = new Dexie(STATIC_DICTIONARY_DB_NAME);
		versionOneDatabase.version(1).stores({ dict: "word", lemma: "surface" });
		await versionOneDatabase.table("lemma").bulkPut([
			{ lemma: "run", surface: "ran" },
			{ lemma: "run", surface: "runs" },
			{ lemma: "agenda", surface: "agendas" },
		]);
		versionOneDatabase.close();

		const database = new StaticDictionaryDatabase();
		try {
			await expect(
				database.lemma.where("lemma").anyOf(["run"]).primaryKeys(),
			).resolves.toEqual(["ran", "runs"]);
		} finally {
			database.close();
		}
	});
});
