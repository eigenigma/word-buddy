import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it } from "vitest";

import {
	createInMemoryDictionaryRepositories,
	type DictionaryRows,
} from "@/test-helpers/dictionaryFixtures";

import { createDictionaryAssetLoader } from "./assets";
import {
	createDictionaryResolveService,
	type DictionaryResolveService,
} from "./resolveService";

const PUBLIC_DIRECTORY = new URL("../../../public/", import.meta.url);

async function readPublicAsset(assetUrl: string): Promise<Response> {
	return new Response(await readFile(new URL(assetUrl), "utf8"));
}

async function loadGeneratedDictionary(): Promise<DictionaryRows> {
	const loader = createDictionaryAssetLoader({
		fetch: readPublicAsset,
		getUrl: (assetPath: string): string =>
			new URL(`.${assetPath}`, PUBLIC_DIRECTORY).href,
	});
	try {
		const manifest = await loader.loadManifest();
		const [shards, lemmaEntries] = await Promise.all([
			Array.fromAsync(loader.loadDictShards(manifest)),
			loader.loadLemmaEntries(),
		]);
		return { dictEntries: shards.flat(), lemmaEntries: lemmaEntries };
	} catch (error) {
		throw new Error(
			"Cannot load the generated dictionary from public/data. Run `bun run fetch:dict && bun run build:dict` first.",
			{ cause: error },
		);
	}
}

let service: DictionaryResolveService;

beforeAll(async () => {
	service = createDictionaryResolveService(
		createInMemoryDictionaryRepositories(await loadGeneratedDictionary()),
	);
});

describe("resolve against the generated dictionary", () => {
	it("finds agenda with phonetic, translation and definition", async () => {
		const resolution = await service.resolve("agenda");

		expect(resolution?.lemma).toBe("agenda");
		expect(resolution?.entry?.phonetic).toEqual(expect.any(String));
		expect(resolution?.entry?.translation).toEqual(expect.any(String));
		expect(resolution?.entry?.definition).toEqual(expect.any(String));
	});

	it("maps inflected surfaces without their own entry to the lemma", async () => {
		const [agendas, went] = await Promise.all([
			service.resolve("Agendas"),
			service.resolve("went"),
		]);

		expect(agendas?.lemma).toBe("agenda");
		expect(agendas?.entry?.word).toBe("agenda");
		expect(went?.lemma).toBe("go");
		expect(went?.entry?.word).toBe("go");
	});

	it("keeps a surface that has its own entry", async () => {
		const running = await service.resolve("running");

		expect(running?.lemma).toBe("running");
		expect(running?.entry?.word).toBe("running");
	});
});
