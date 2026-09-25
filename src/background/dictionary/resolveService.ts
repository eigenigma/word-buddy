import type { DictionaryEntry } from "@/shared/dictionary/types";
import { normalizeLookupTerm, normalizeWord } from "@/shared/dictionary/utils";

import type {
	DictionaryEntryRepository,
	LemmaRepository,
} from "./repositories";

export interface DictionaryResolution {
	readonly entry: DictionaryEntry | null;
	readonly lemma: string;
}

export interface DictionaryResolveServiceDependencies {
	readonly dictRepository: DictionaryEntryRepository;
	readonly lemmaRepository: Pick<LemmaRepository, "getLemmaBySurface">;
}

export interface DictionaryResolveService {
	readonly resolve: (selection: string) => Promise<DictionaryResolution | null>;
}

function toFallbackLemma(selection: string): string | null {
	const trimmedSelection = selection.trim();
	return trimmedSelection ? trimmedSelection.toLowerCase() : null;
}

// Precedence: an exact entry for the selection, then its lemma mapping,
// then the selection itself. Phrases collapse whitespace for the entry
// lookup; only single words go through the lemma table.
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
			const selectionTerm = normalizeLookupTerm(selection);
			const exactEntry = await getEntry(selectionTerm);
			if (exactEntry) {
				return { entry: exactEntry, lemma: exactEntry.word };
			}

			const surface = normalizeWord(selection);
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

			// The fallback looks up as the selection's own term, which just missed.
			const fallbackLemma = toFallbackLemma(selection);
			return fallbackLemma === null
				? null
				: { entry: null, lemma: fallbackLemma };
		},
	};
}
