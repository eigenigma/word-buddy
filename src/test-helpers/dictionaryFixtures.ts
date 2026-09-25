import type {
	DictionaryEntryRepository,
	LemmaRepository,
} from "../background/dictionary/repositories";
import type { DictionaryEntry, LemmaEntry } from "../shared/dictionary/types";

export interface DictionaryRows {
	readonly dictEntries: readonly DictionaryEntry[];
	readonly lemmaEntries: readonly LemmaEntry[];
}

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
}: DictionaryRows): {
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
