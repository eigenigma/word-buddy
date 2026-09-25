import type { DictionaryEntry } from "@/shared/dictionary/types";
import { normalizeLookupTerm, normalizeWord } from "@/shared/dictionary/utils";

import type {
	DictionaryEntryRepository,
	LemmaRepository,
} from "./repositories";

export interface DictionaryQueryServiceDependencies {
	readonly dictRepository: DictionaryEntryRepository;
	readonly lemmaRepository: Pick<LemmaRepository, "getLemmaBySurface">;
}

export interface DictionaryQueryService {
	readonly lookupExactWord: (word: string) => Promise<DictionaryEntry | null>;
	readonly normalizeSurface: (surface: string) => Promise<string | null>;
}

export function createDictionaryQueryService(
	dependencies: DictionaryQueryServiceDependencies,
): DictionaryQueryService {
	return {
		lookupExactWord: async (word: string): Promise<DictionaryEntry | null> => {
			const normalizedWord = normalizeLookupTerm(word);
			if (!normalizedWord) {
				return null;
			}

			return await dependencies.dictRepository.getByWord(normalizedWord);
		},

		normalizeSurface: async (surface: string): Promise<string | null> => {
			const normalizedSurface = normalizeWord(surface);
			if (!normalizedSurface) {
				return null;
			}

			const lemma =
				await dependencies.lemmaRepository.getLemmaBySurface(normalizedSurface);
			if (lemma) {
				return lemma;
			}

			const entry =
				await dependencies.dictRepository.getByWord(normalizedSurface);
			return entry?.word ?? null;
		},
	};
}
