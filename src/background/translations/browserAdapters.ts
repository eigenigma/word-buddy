import {
	createTranslationCacheService,
	type TranslationCacheService,
} from "@/background/translations/service";
import { userDb } from "@/background/wordbook/database";
import type { TranslationCacheEntry } from "@/shared/translations/types";

export function createTranslationCacheBrowserAdapter(): TranslationCacheService {
	return createTranslationCacheService({
		repository: {
			clearAll: () => userDb.translations.clear(),
			count: () => userDb.translations.count(),
			getByHash: (hash: string) => userDb.translations.get(hash),
			putEntry: (entry: TranslationCacheEntry) =>
				userDb.translations.put(entry),
		},
	});
}
