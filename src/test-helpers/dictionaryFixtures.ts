import type { DictionarySeedAssets } from "../background/dictionary/assets";
import type {
	DictionaryEntryRepository,
	LemmaRepository,
} from "../background/dictionary/repositories";
import type { DictionaryEntry } from "../shared/dictionary/types";

export function createTestDictionaryEntry(
	word: string,
	overrides: Partial<DictionaryEntry> = {},
): DictionaryEntry {
	return {
		definition: `${word} definition`,
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
		translation: `${word} translation`,
		word: word,
		...overrides,
	};
}

export function createInMemoryDictionaryRepositories({
	dictEntries,
	lemmaEntries,
}: DictionarySeedAssets): {
	readonly dictRepository: DictionaryEntryRepository;
	readonly lemmaRepository: LemmaRepository;
} {
	const entriesByWord = new Map(
		dictEntries.map((entry) => [entry.word, entry] as const),
	);
	const lemmaBySurface = new Map(
		lemmaEntries.map((entry) => [entry.surface, entry.lemma] as const),
	);

	return {
		dictRepository: {
			getByWord: async (word: string) => entriesByWord.get(word) ?? null,
		},
		lemmaRepository: {
			getLemmaBySurface: async (surface: string) =>
				lemmaBySurface.get(surface) ?? null,
			listByLemmas: async (lemmas: readonly string[]) =>
				lemmaEntries.filter((entry) => lemmas.includes(entry.lemma)),
		},
	};
}
