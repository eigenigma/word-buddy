import { z } from "zod";

import type { DictionarySeedState, DictionarySeedStateStorage } from "./seed";

const STATIC_DICTIONARY_SEED_KEY = "staticDictionarySeedState";

const DictionarySeedStateSchema: z.ZodType<DictionarySeedState> = z
	.object({
		assetFingerprint: z.string(),
		seedFormatVersion: z.number(),
	})
	.readonly();

export function createBrowserDictionarySeedStateStorage(): DictionarySeedStateStorage {
	return {
		clearState: async (): Promise<void> => {
			await browser.storage.local.remove(STATIC_DICTIONARY_SEED_KEY);
		},
		readState: async (): Promise<DictionarySeedState | null> => {
			const storageValue = await browser.storage.local.get(
				STATIC_DICTIONARY_SEED_KEY,
			);
			const seedState = storageValue[STATIC_DICTIONARY_SEED_KEY];
			const parsedSeedState = DictionarySeedStateSchema.safeParse(seedState);

			return parsedSeedState.success ? parsedSeedState.data : null;
		},
		writeState: async (seedState: DictionarySeedState): Promise<void> => {
			await browser.storage.local.set({
				[STATIC_DICTIONARY_SEED_KEY]: seedState,
			});
		},
	};
}
