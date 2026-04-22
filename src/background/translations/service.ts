import type { TranslationCacheEntry } from "@/shared/translations/types";

export interface TranslationRepository {
	readonly clearAll: () => Promise<void>;
	readonly count: () => Promise<number>;
	readonly getByHash: (
		hash: string,
	) => Promise<TranslationCacheEntry | undefined>;
	readonly putEntry: (entry: TranslationCacheEntry) => Promise<string>;
}

export interface TranslationCacheServiceDependencies {
	readonly repository: TranslationRepository;
}

export interface TranslationCacheService {
	readonly clear: () => Promise<number>;
	readonly get: (hash: string) => Promise<TranslationCacheEntry | null>;
	readonly set: (entry: TranslationCacheEntry) => Promise<void>;
}

export function createTranslationCacheService(
	dependencies: TranslationCacheServiceDependencies,
): TranslationCacheService {
	return {
		clear: async (): Promise<number> => {
			const existingCount = await dependencies.repository.count();
			await dependencies.repository.clearAll();
			return existingCount;
		},
		get: async (hash: string): Promise<TranslationCacheEntry | null> =>
			(await dependencies.repository.getByHash(hash)) ?? null,
		set: async (entry: TranslationCacheEntry): Promise<void> => {
			await dependencies.repository.putEntry(entry);
		},
	};
}
