import { z } from "zod";

import { DictionaryEntrySchema } from "@/shared/dictionary/schemas";
import type {
	DictionaryResolution,
	LemmaExpansions,
} from "@/shared/dictionary/types";

const ReadonlyStringArraySchema: z.ZodType<readonly string[]> = z
	.array(z.string())
	.readonly();
const LemmaExpansionsSchema: z.ZodType<LemmaExpansions> = z
	.record(z.string(), ReadonlyStringArraySchema)
	.readonly();
const DictionaryResolutionSchema: z.ZodType<DictionaryResolution> = z
	.object({
		entry: DictionaryEntrySchema.nullable(),
		lemma: z.string(),
	})
	.readonly();

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
		resolution: DictionaryResolutionSchema.nullable(),
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
