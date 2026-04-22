import { readFile } from "node:fs/promises";

import { beforeAll, describe, expect, it, vi } from "vitest";

import type {
	DictionaryBuildMetadata,
	DictionaryEntry,
	LemmaIndex,
} from "../../shared/dictionary/types";

vi.mock(
	"@/shared/dictionary/utils",
	async () => import("../../shared/dictionary/utils"),
);

type DictionaryQueryService = import("./queryService").DictionaryQueryService;
type CreateDictionaryQueryService =
	typeof import("./queryService").createDictionaryQueryService;

const DATA_DIRECTORY = new URL("../../../public/data/", import.meta.url);
const META_PATH = new URL("dict-meta.json", DATA_DIRECTORY);
const LEMMA_PATH = new URL("lemma-index.json", DATA_DIRECTORY);

async function loadArtifacts(): Promise<{
	dictEntries: readonly DictionaryEntry[];
	lemmaIndex: LemmaIndex;
}> {
	const [metaText, lemmaText] = await Promise.all([
		readFile(META_PATH, "utf8"),
		readFile(LEMMA_PATH, "utf8"),
	]);
	const metadata = JSON.parse(metaText) as DictionaryBuildMetadata;
	const shardTexts = await Promise.all(
		Array.from({ length: metadata.dictShardCount }, (_, index: number) =>
			readFile(new URL(`dict-${index}.json`, DATA_DIRECTORY), "utf8"),
		),
	);

	return {
		dictEntries: shardTexts.flatMap(
			(text: string): readonly DictionaryEntry[] =>
				JSON.parse(text) as readonly DictionaryEntry[],
		),
		lemmaIndex: JSON.parse(lemmaText) as LemmaIndex,
	};
}

let createDictionaryQueryService: CreateDictionaryQueryService;
let service: DictionaryQueryService;

beforeAll(async () => {
	({ createDictionaryQueryService } = await import("./queryService"));
	const { dictEntries, lemmaIndex } = await loadArtifacts();
	const dictMap = new Map(
		dictEntries.map((entry: DictionaryEntry) => [entry.word, entry] as const),
	);

	service = createDictionaryQueryService({
		dictRepository: {
			getByWord: async (word: string) => dictMap.get(word),
		},
		lemmaRepository: {
			getBySurface: async (surface: string) => lemmaIndex[surface],
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
