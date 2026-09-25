import { z } from "zod";

import type {
	DictionaryFrequencyMetadata,
	LemmaExpansions,
} from "@/shared/dictionary/types";

const NumberSchema: z.ZodType<number> = z.custom<number>(
	(value): value is number => typeof value === "number",
);
const NullableStringSchema = z.string().nullable();
const ReadonlyStringArraySchema: z.ZodType<readonly string[]> = z
	.array(z.string())
	.readonly();
const LemmaExpansionsSchema: z.ZodType<LemmaExpansions> = z
	.record(z.string(), ReadonlyStringArraySchema)
	.readonly();

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

export const DICTIONARY_RESOLVE_MESSAGE_TYPE =
	"wordBuddy.dictionary.resolve" as const;
export const DICTIONARY_EXPAND_LEMMAS_MESSAGE_TYPE =
	"wordBuddy.dictionary.expandLemmas" as const;

export const DictionaryResolveRequestSchema = z
	.object({
		selection: z.string(),
		type: z.literal(DICTIONARY_RESOLVE_MESSAGE_TYPE),
	})
	.readonly();
export type DictionaryResolveRequest = z.infer<
	typeof DictionaryResolveRequestSchema
>;

export const DictionaryResolveResponseSchema = z
	.object({
		resolution: z
			.object({
				entry: DictionaryLookupResultSchema.nullable(),
				lemma: z.string(),
			})
			.readonly()
			.nullable(),
	})
	.readonly();
export type DictionaryResolveResponse = z.infer<
	typeof DictionaryResolveResponseSchema
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
		expansions: LemmaExpansionsSchema,
	})
	.readonly();
export type DictionaryExpandLemmasResponse = z.infer<
	typeof DictionaryExpandLemmasResponseSchema
>;
