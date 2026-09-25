import type { DictionaryEntry, LemmaEntry } from "@/shared/dictionary/types";

export interface DictionaryEntryRepository {
	readonly getByWord: (word: string) => Promise<DictionaryEntry | null>;
}

export interface LemmaRepository {
	readonly getLemmaBySurface: (surface: string) => Promise<string | null>;
	readonly listByLemmas: (
		lemmas: readonly string[],
	) => Promise<readonly LemmaEntry[]>;
}
