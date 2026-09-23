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

type ReverseIndex = ReadonlyMap<string, readonly string[]>;

function buildReverseIndex(
	entries: readonly { lemma: string; surface: string }[],
): ReverseIndex {
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
	reverseIndex: ReverseIndex,
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
	let reverseIndexPromise: Promise<ReverseIndex> | null = null;

	return {
		expandLemmas: async (
			lemmas: readonly string[],
		): Promise<Readonly<Record<string, readonly string[]>>> => {
			if (lemmas.length === 0) {
				return Object.freeze({});
			}

			reverseIndexPromise ??= dependencies.repository
				.listAll()
				.then(buildReverseIndex)
				.catch((error: unknown): never => {
					reverseIndexPromise = null;
					throw error;
				});

			return buildExpansionResult(lemmas, await reverseIndexPromise);
		},
	};
}
