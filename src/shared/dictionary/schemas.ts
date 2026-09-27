import { z } from "zod";

import {
	NullableStringSchema,
	ReadonlyStringArraySchema,
} from "@/shared/utils/schemas";

import type { DictionaryEntry } from "./types";

export const DictionaryEntrySchema: z.ZodType<DictionaryEntry> = z
	.object({
		definition: NullableStringSchema,
		frequency: z
			.object({
				bnc: z.number().nullable(),
				collins: z.number().nullable(),
				frq: z.number().nullable(),
				oxford: z.boolean(),
				tags: ReadonlyStringArraySchema,
			})
			.readonly(),
		phonetic: NullableStringSchema,
		pos: NullableStringSchema,
		translation: NullableStringSchema,
		word: z.string(),
	})
	.readonly();
