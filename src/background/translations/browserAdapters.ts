import {
	createTranslationCacheService,
	type TranslationCacheService,
	type TranslationRepository,
} from "@/background/translations/service";
import {
	userDb,
	type WordBuddyUserDatabase,
} from "@/background/wordbook/database";
import type { TranslationCacheEntry } from "@/shared/translations/types";

export function createTranslationRepository(
	database: WordBuddyUserDatabase,
): TranslationRepository {
	return {
		clearAll: () => database.translations.clear(),
		count: () => database.translations.count(),
		getByHash: (hash: string) => database.translations.get(hash),
		putEntry: (entry: TranslationCacheEntry) =>
			database.translations.put(entry),
	};
}

export function createTranslationCacheBrowserAdapter(): TranslationCacheService {
	return createTranslationCacheService({
		repository: createTranslationRepository(userDb),
	});
}
