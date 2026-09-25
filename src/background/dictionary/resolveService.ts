import type {
	DictionaryEntry,
	DictionaryResolution,
} from "@/shared/dictionary/types";
import {
	foldTermText,
	normalizeLookupTerm,
	normalizeWord,
} from "@/shared/dictionary/utils";

import type {
	DictionaryEntryRepository,
	LemmaRepository,
} from "./repositories";

export interface DictionaryResolveServiceDependencies {
	readonly dictRepository: DictionaryEntryRepository;
	readonly lemmaRepository: Pick<LemmaRepository, "getLemmaBySurface">;
}

export interface DictionaryResolveService {
	readonly resolve: (selection: string) => Promise<DictionaryResolution | null>;
}

// Precedence: an exact entry for the selection, then its lemma mapping,
// then the selection itself. Every step uses the folded selection, so
// whitespace collapses everywhere; only single words go through the lemma
// table.
export function createDictionaryResolveService(
	dependencies: DictionaryResolveServiceDependencies,
): DictionaryResolveService {
	const getEntry = async (
		lookupTerm: string | null,
	): Promise<DictionaryEntry | null> =>
		lookupTerm === null
			? null
			: await dependencies.dictRepository.getByWord(lookupTerm);

	return {
		resolve: async (
			selection: string,
		): Promise<DictionaryResolution | null> => {
			const term = foldTermText(selection);
			if (term === "") {
				return null;
			}

			const exactEntry = await getEntry(normalizeLookupTerm(term));
			if (exactEntry) {
				return { entry: exactEntry, lemma: exactEntry.word };
			}

			const surface = normalizeWord(term);
			const mappedLemma =
				surface === null
					? null
					: await dependencies.lemmaRepository.getLemmaBySurface(surface);
			if (mappedLemma !== null) {
				return {
					entry: await getEntry(normalizeLookupTerm(mappedLemma)),
					lemma: mappedLemma,
				};
			}

			return { entry: null, lemma: term };
		},
	};
}
