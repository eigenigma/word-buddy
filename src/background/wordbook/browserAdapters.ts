import { userDb } from "@/background/wordbook/database";
import {
	createWordbookService,
	type WordbookService,
} from "@/background/wordbook/service";
import type {
	WordbookEntry,
	WordbookUpdatePatch,
} from "@/shared/wordbook/types";

export function createWordbookBrowserAdapter(): WordbookService {
	return createWordbookService({
		repository: {
			deleteByLemma: (lemma: string) => userDb.words.delete(lemma),
			getByLemma: (lemma: string) => userDb.words.get(lemma),
			listAll: () => userDb.words.orderBy("addedAt").reverse().toArray(),
			putWord: (entry: WordbookEntry) => userDb.words.put(entry),
			updateByLemma: (lemma: string, patch: WordbookUpdatePatch) =>
				userDb.words.update(lemma, patch),
		},
	});
}
