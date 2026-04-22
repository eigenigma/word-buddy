import type {
	WordbookEntry,
	WordbookUpdatePatch,
} from "@/shared/wordbook/types";

export interface WordRepository {
	readonly deleteByLemma: (lemma: string) => Promise<void>;
	readonly getByLemma: (lemma: string) => Promise<WordbookEntry | undefined>;
	readonly listAll: () => Promise<readonly WordbookEntry[]>;
	readonly putWord: (entry: WordbookEntry) => Promise<string>;
	readonly updateByLemma: (
		lemma: string,
		patch: WordbookUpdatePatch,
	) => Promise<number>;
}

export interface WordbookServiceDependencies {
	readonly repository: WordRepository;
}

export interface WordbookAddOutcome {
	readonly added: boolean;
}

export interface WordbookRemoveOutcome {
	readonly removed: boolean;
}

export interface WordbookUpdateOutcome {
	readonly entry: WordbookEntry | null;
	readonly updated: boolean;
}

export interface WordbookService {
	readonly addWord: (input: WordbookEntry) => Promise<WordbookAddOutcome>;
	readonly existsByLemma: (lemma: string) => Promise<boolean>;
	readonly listAll: () => Promise<readonly WordbookEntry[]>;
	readonly removeByLemma: (lemma: string) => Promise<WordbookRemoveOutcome>;
	readonly updateEntry: (
		lemma: string,
		patch: WordbookUpdatePatch,
	) => Promise<WordbookUpdateOutcome>;
}

async function addWord(
	dependencies: WordbookServiceDependencies,
	input: WordbookEntry,
): Promise<WordbookAddOutcome> {
	const existingEntry = await dependencies.repository.getByLemma(input.lemma);
	if (existingEntry) {
		return {
			added: false,
		};
	}

	await dependencies.repository.putWord({
		addedAt: input.addedAt,
		context: input.context,
		lemma: input.lemma,
		original: input.original,
		sourceUrl: input.sourceUrl,
	});
	return {
		added: true,
	};
}

async function removeByLemma(
	dependencies: WordbookServiceDependencies,
	lemma: string,
): Promise<WordbookRemoveOutcome> {
	const existingEntry = await dependencies.repository.getByLemma(lemma);
	if (!existingEntry) {
		return {
			removed: false,
		};
	}

	await dependencies.repository.deleteByLemma(lemma);
	return {
		removed: true,
	};
}

async function updateEntry(
	dependencies: WordbookServiceDependencies,
	lemma: string,
	patch: WordbookUpdatePatch,
): Promise<WordbookUpdateOutcome> {
	const existingEntry = await dependencies.repository.getByLemma(lemma);
	if (!existingEntry) {
		return {
			entry: null,
			updated: false,
		};
	}

	const updatedCount = await dependencies.repository.updateByLemma(
		lemma,
		patch,
	);
	if (updatedCount === 0) {
		return {
			entry: null,
			updated: false,
		};
	}

	return {
		entry: (await dependencies.repository.getByLemma(lemma)) ?? null,
		updated: true,
	};
}

export function createWordbookService(
	dependencies: WordbookServiceDependencies,
): WordbookService {
	return {
		addWord: async (input: WordbookEntry): Promise<WordbookAddOutcome> =>
			await addWord(dependencies, input),
		existsByLemma: async (lemma: string): Promise<boolean> =>
			(await dependencies.repository.getByLemma(lemma)) !== undefined,
		listAll: async (): Promise<readonly WordbookEntry[]> =>
			await dependencies.repository.listAll(),
		removeByLemma: async (lemma: string): Promise<WordbookRemoveOutcome> =>
			await removeByLemma(dependencies, lemma),
		updateEntry: async (
			lemma: string,
			patch: WordbookUpdatePatch,
		): Promise<WordbookUpdateOutcome> =>
			await updateEntry(dependencies, lemma, patch),
	};
}
