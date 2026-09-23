export interface LemmaReverseRepository {
	readonly listAll: () => Promise<
		readonly { lemma: string; surface: string }[]
	>;
}

export interface LemmaExpansionServiceDependencies {
	readonly repository: LemmaReverseRepository;
}

export interface LemmaExpansionService {
	readonly expandLemmas: (
		lemmas: readonly string[],
	) => Promise<Readonly<Record<string, readonly string[]>>>;
}

function buildReverseIndex(
	entries: readonly { lemma: string; surface: string }[],
): Map<string, readonly string[]> {
	const mutableIndex = new Map<string, Set<string>>();

	for (const entry of entries) {
		const surfaces = mutableIndex.get(entry.lemma);
		if (surfaces) {
			surfaces.add(entry.surface);
			continue;
		}

		mutableIndex.set(entry.lemma, new Set<string>([entry.surface]));
	}

	const reverseIndex = new Map<string, readonly string[]>();
	for (const [lemma, surfaces] of mutableIndex) {
		surfaces.add(lemma);
		reverseIndex.set(lemma, Object.freeze(Array.from(surfaces)));
	}

	return reverseIndex;
}

function buildExpansionResult(
	lemmas: readonly string[],
	reverseIndex: ReadonlyMap<string, readonly string[]>,
): Readonly<Record<string, readonly string[]>> {
	const expansions: Record<string, readonly string[]> = {};

	for (const lemma of lemmas) {
		expansions[lemma] = reverseIndex.get(lemma) ?? Object.freeze([lemma]);
	}

	return Object.freeze(expansions);
}

export function createLemmaExpansionService(
	dependencies: LemmaExpansionServiceDependencies,
): LemmaExpansionService {
	let reverseIndex: Map<string, readonly string[]> | null = null;

	return {
		expandLemmas: async (
			lemmas: readonly string[],
		): Promise<Readonly<Record<string, readonly string[]>>> => {
			if (lemmas.length === 0) {
				return Object.freeze({});
			}

			reverseIndex ??= buildReverseIndex(
				await dependencies.repository.listAll(),
			);

			return buildExpansionResult(lemmas, reverseIndex);
		},
	};
}
