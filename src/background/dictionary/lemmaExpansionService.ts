import type { LemmaEntry } from "@/shared/dictionary/types";

export interface LemmaReverseRepository {
	readonly listByLemmas: (
		lemmas: readonly string[],
	) => Promise<readonly LemmaEntry[]>;
}

export interface LemmaExpansionServiceDependencies {
	readonly repository: LemmaReverseRepository;
}

export interface LemmaExpansionService {
	readonly expandLemmas: (
		lemmas: readonly string[],
	) => Promise<Readonly<Record<string, readonly string[]>>>;
}

function buildExpansionResult(
	lemmas: readonly string[],
	entries: readonly LemmaEntry[],
): Readonly<Record<string, readonly string[]>> {
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
		): Promise<Readonly<Record<string, readonly string[]>>> => {
			if (lemmas.length === 0) {
				return Object.freeze({});
			}

			const entries = await dependencies.repository.listByLemmas(lemmas);
			return buildExpansionResult(lemmas, entries);
		},
	};
}
