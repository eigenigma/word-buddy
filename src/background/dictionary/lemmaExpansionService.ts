import type { LemmaEntry, LemmaExpansions } from "@/shared/dictionary/types";

import type { LemmaRepository } from "./repositories";

export interface LemmaExpansionServiceDependencies {
	readonly lemmaRepository: Pick<LemmaRepository, "listByLemmas">;
}

export interface LemmaExpansionService {
	readonly expandLemmas: (
		lemmas: readonly string[],
	) => Promise<LemmaExpansions>;
}

function buildExpansionResult(
	lemmas: readonly string[],
	entries: readonly LemmaEntry[],
): LemmaExpansions {
	const surfacesByLemma = new Map(
		lemmas.map((lemma) => [lemma, new Set<string>()]),
	);
	for (const entry of entries) {
		surfacesByLemma.get(entry.lemma)?.add(entry.surface);
	}

	const expansions: Record<string, readonly string[]> = {};
	for (const [lemma, surfaces] of surfacesByLemma) {
		surfaces.add(lemma);
		expansions[lemma] = Object.freeze(Array.from(surfaces));
	}

	return Object.freeze(expansions);
}

export function createLemmaExpansionService(
	dependencies: LemmaExpansionServiceDependencies,
): LemmaExpansionService {
	return {
		expandLemmas: async (
			lemmas: readonly string[],
		): Promise<LemmaExpansions> => {
			if (lemmas.length === 0) {
				return Object.freeze({});
			}

			const entries = await dependencies.lemmaRepository.listByLemmas(lemmas);
			return buildExpansionResult(lemmas, entries);
		},
	};
}
