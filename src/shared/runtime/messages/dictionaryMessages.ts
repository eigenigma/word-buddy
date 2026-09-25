import { z } from "zod";

import type { DictionaryFrequencyMetadata } from "@/shared/dictionary/types";

const NumberSchema: z.ZodType<number> = z.custom<number>(
	(value): value is number => typeof value === "number",
);
const NullableStringSchema = z.string().nullable();
const ReadonlyStringArraySchema: z.ZodType<readonly string[]> = z
	.array(z.string())
	.readonly();
const ReadonlyStringArrayRecordSchema: z.ZodType<
	Readonly<Record<string, readonly string[]>>
> = z.record(z.string(), ReadonlyStringArraySchema).readonly();

const DictionaryFrequencyMetadataSchema: z.ZodType<DictionaryFrequencyMetadata> =
	z
		.object({
			bnc: NumberSchema.nullable(),
			collins: NumberSchema.nullable(),
			frq: NumberSchema.nullable(),
			oxford: z.boolean(),
			tags: ReadonlyStringArraySchema,
		})
		.readonly();

const DictionaryLookupResultSchema = z
	.object({
		definition: NullableStringSchema,
		frequency: DictionaryFrequencyMetadataSchema,
		phonetic: NullableStringSchema,
		pos: NullableStringSchema,
		translation: NullableStringSchema,
		word: z.string(),
	})
	.readonly();
export type DictionaryLookupResult = z.infer<
	typeof DictionaryLookupResultSchema
>;

export const DICTIONARY_LOOKUP_MESSAGE_TYPE =
	"wordBuddy.dictionary.lookup" as const;
export const LEMMA_NORMALIZE_MESSAGE_TYPE =
	"wordBuddy.dictionary.normalize" as const;
export const DICTIONARY_EXPAND_LEMMAS_MESSAGE_TYPE =
	"wordBuddy.dictionary.expandLemmas" as const;

export const DictionaryLookupRequestSchema = z
	.object({
		type: z.literal(DICTIONARY_LOOKUP_MESSAGE_TYPE),
		word: z.string(),
	})
	.readonly();
export type DictionaryLookupRequest = z.infer<
	typeof DictionaryLookupRequestSchema
>;

export const DictionaryLookupResponseSchema = z
	.object({
		entry: DictionaryLookupResultSchema.nullable(),
	})
	.readonly();
export type DictionaryLookupResponse = z.infer<
	typeof DictionaryLookupResponseSchema
>;

export const LemmaNormalizeRequestSchema = z
	.object({
		surface: z.string(),
		type: z.literal(LEMMA_NORMALIZE_MESSAGE_TYPE),
	})
	.readonly();
export type LemmaNormalizeRequest = z.infer<typeof LemmaNormalizeRequestSchema>;

export const LemmaNormalizeResponseSchema = z
	.object({
		lemma: z.string().nullable(),
	})
	.readonly();
export type LemmaNormalizeResponse = z.infer<
	typeof LemmaNormalizeResponseSchema
>;

export const DictionaryExpandLemmasRequestSchema = z
	.object({
		lemmas: ReadonlyStringArraySchema,
		type: z.literal(DICTIONARY_EXPAND_LEMMAS_MESSAGE_TYPE),
	})
	.readonly();
export type DictionaryExpandLemmasRequest = z.infer<
	typeof DictionaryExpandLemmasRequestSchema
>;

export const DictionaryExpandLemmasResponseSchema = z
	.object({
		expansions: ReadonlyStringArrayRecordSchema,
	})
	.readonly();
export type DictionaryExpandLemmasResponse = z.infer<
	typeof DictionaryExpandLemmasResponseSchema
>;
