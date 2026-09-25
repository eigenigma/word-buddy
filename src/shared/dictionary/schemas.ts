import { z } from "zod";

import type { DictionaryEntry } from "./types";

export const DictionaryEntrySchema: z.ZodType<DictionaryEntry> = z
	.object({
		definition: z.string().nullable(),
		frequency: z
			.object({
				bnc: z.number().nullable(),
				collins: z.number().nullable(),
				frq: z.number().nullable(),
				oxford: z.boolean(),
				tags: z.array(z.string()).readonly(),
			})
			.readonly(),
		phonetic: z.string().nullable(),
		pos: z.string().nullable(),
		translation: z.string().nullable(),
		word: z.string(),
	})
	.readonly();
