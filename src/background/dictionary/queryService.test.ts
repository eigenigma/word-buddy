import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type {
	DictionaryEntry,
	LemmaEntry,
} from "../../shared/dictionary/types";
import {
	createDictionaryAssetLoader,
	type DictionarySeedAssets,
} from "./assets";

vi.mock(
	"@/shared/dictionary/utils",
	async () => import("../../shared/dictionary/utils"),
);

type DictionaryQueryService = import("./queryService").DictionaryQueryService;
type CreateDictionaryQueryService =
	typeof import("./queryService").createDictionaryQueryService;

const PUBLIC_DIRECTORY = new URL("../../../public/", import.meta.url);

function resolvePublicAssetUrl(assetPath: string): string {
	return new URL(`.${assetPath}`, PUBLIC_DIRECTORY).href;
}

async function fetchPublicAsset(assetUrl: string): Promise<Response> {
	return new Response(await readFile(new URL(assetUrl), "utf8"));
}

async function loadArtifacts(): Promise<DictionarySeedAssets> {
	const loader = createDictionaryAssetLoader({
		fetch: fetchPublicAsset,
		getUrl: resolvePublicAssetUrl,
	});
	return await loader.loadAssets(await loader.loadManifest());
}

let createDictionaryQueryService: CreateDictionaryQueryService;
let service: DictionaryQueryService;

beforeAll(async () => {
	({ createDictionaryQueryService } = await import("./queryService"));
	const { dictEntries, lemmaEntries } = await loadArtifacts();
	const dictMap = new Map(
		dictEntries.map((entry: DictionaryEntry) => [entry.word, entry] as const),
	);
	const lemmaMap = new Map(
		lemmaEntries.map(
			(entry: LemmaEntry) => [entry.surface, entry.lemma] as const,
		),
	);

	service = createDictionaryQueryService({
		dictRepository: {
			getByWord: async (word: string) => dictMap.get(word),
		},
		lemmaRepository: {
			getBySurface: async (surface: string) => lemmaMap.get(surface),
		},
	});
});

describe("createDictionaryQueryService with real dictionary artifacts", () => {
	it("looks up agenda with phonetic translation and definition", async () => {
		const agendaLookup = await service.lookupExactWord("agenda");

		expect(agendaLookup).not.toBeNull();
		expect(agendaLookup?.phonetic).not.toBeNull();
		expect(agendaLookup?.translation).not.toBeNull();
		expect(agendaLookup?.definition).not.toBeNull();
	});

	it("normalizes plural and progressive surfaces to their lemmas", async () => {
		const [agendasNormalization, runningNormalization] = await Promise.all([
			service.normalizeSurface("agendas"),
			service.normalizeSurface("running"),
		]);

		expect(agendasNormalization).toBe("agenda");
		expect(runningNormalization).toBe("run");
	});
});

describe("createDictionaryQueryService edge cases", () => {
	it("returns null for lookup and normalization inputs that normalize to empty strings", async () => {
		const emptyInputService = createDictionaryQueryService({
			dictRepository: {
				getByWord: async (): Promise<DictionaryEntry | undefined> => {
					throw new Error(
						"dict lookup should not run for empty normalized input",
					);
				},
			},
			lemmaRepository: {
				getBySurface: async (): Promise<string | undefined> => {
					throw new Error(
						"lemma lookup should not run for empty normalized input",
					);
				},
			},
		});

		await expect(emptyInputService.lookupExactWord("!!!")).resolves.toBeNull();
		await expect(emptyInputService.normalizeSurface("!!!")).resolves.toBeNull();
	});

	it("falls back to the dictionary entry word when no lemma mapping exists", async () => {
		const fallbackEntry: DictionaryEntry = {
			definition: "meeting plan",
			frequency: {
				bnc: 1,
				collins: 1,
				frq: 1,
				oxford: true,
				tags: ["bnc"],
			},
			morphology: {
				exchange: {},
			},
			phonetic: null,
			pos: "n.",
			translation: "议程",
			word: "agenda",
		};
		const fallbackService = createDictionaryQueryService({
			dictRepository: {
				getByWord: async (
					word: string,
				): Promise<DictionaryEntry | undefined> =>
					word === "agenda" ? fallbackEntry : undefined,
			},
			lemmaRepository: {
				getBySurface: async (): Promise<string | undefined> => undefined,
			},
		});

		await expect(fallbackService.normalizeSurface("agenda")).resolves.toBe(
			"agenda",
		);
	});
});
