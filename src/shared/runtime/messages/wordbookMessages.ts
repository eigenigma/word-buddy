import { z } from "zod";

import type {
	WordbookEntry,
	WordbookUpdatePatch,
} from "@/shared/wordbook/types";

const NumberSchema: z.ZodType<number> = z.custom<number>(
	(value): value is number => typeof value === "number",
);
const FiniteNumberSchema: z.ZodType<number> = NumberSchema.refine((value) =>
	Number.isFinite(value),
);
const NullableStringSchema = z.string().nullable();

const WordbookEntrySchema: z.ZodType<WordbookEntry> = z
	.object({
		addedAt: NumberSchema,
		context: NullableStringSchema,
		lemma: z.string(),
		original: z.string(),
		sourceUrl: NullableStringSchema,
	})
	.readonly();

const WordbookAddInputSchema: z.ZodType<WordbookEntry> = z
	.object({
		addedAt: FiniteNumberSchema,
		context: NullableStringSchema,
		lemma: z.string(),
		original: z.string(),
		sourceUrl: NullableStringSchema,
	})
	.readonly();

const WordbookUpdatePatchSchema: z.ZodType<WordbookUpdatePatch> = z
	.object({
		context: z.string().nullable().optional(),
		original: z.string().optional(),
	})
	.transform(
		(patch): WordbookUpdatePatch => ({
			...(patch.context === undefined ? {} : { context: patch.context }),
			...(patch.original === undefined ? {} : { original: patch.original }),
		}),
	);

export const WORDBOOK_ADD_MESSAGE_TYPE = "wordBuddy.wordbook.add" as const;
export const WORDBOOK_EXISTS_MESSAGE_TYPE =
	"wordBuddy.wordbook.exists" as const;
export const WORDBOOK_LIST_MESSAGE_TYPE = "wordBuddy.wordbook.list" as const;
export const WORDBOOK_REMOVE_MESSAGE_TYPE =
	"wordBuddy.wordbook.remove" as const;
export const WORDBOOK_UPDATE_MESSAGE_TYPE =
	"wordBuddy.wordbook.update" as const;

export const WordbookAddRequestSchema = z
	.object({
		input: WordbookAddInputSchema,
		type: z.literal(WORDBOOK_ADD_MESSAGE_TYPE),
	})
	.readonly();
export type WordbookAddRequest = z.infer<typeof WordbookAddRequestSchema>;

export const WordbookAddResponseSchema = z
	.object({
		added: z.boolean(),
		error: NullableStringSchema,
	})
	.readonly();
export type WordbookAddResponse = z.infer<typeof WordbookAddResponseSchema>;

export const WordbookExistsRequestSchema = z
	.object({
		lemma: z.string(),
		type: z.literal(WORDBOOK_EXISTS_MESSAGE_TYPE),
	})
	.readonly();
export type WordbookExistsRequest = z.infer<typeof WordbookExistsRequestSchema>;

export const WordbookExistsResponseSchema = z
	.object({
		exists: z.boolean(),
	})
	.readonly();
export type WordbookExistsResponse = z.infer<
	typeof WordbookExistsResponseSchema
>;

export const WordbookListRequestSchema = z
	.object({
		type: z.literal(WORDBOOK_LIST_MESSAGE_TYPE),
	})
	.readonly();
export type WordbookListRequest = z.infer<typeof WordbookListRequestSchema>;

export const WordbookListResponseSchema = z
	.object({
		entries: z.array(WordbookEntrySchema).readonly(),
	})
	.readonly();
export type WordbookListResponse = z.infer<typeof WordbookListResponseSchema>;

export const WordbookRemoveRequestSchema = z
	.object({
		lemma: z.string(),
		type: z.literal(WORDBOOK_REMOVE_MESSAGE_TYPE),
	})
	.readonly();
export type WordbookRemoveRequest = z.infer<typeof WordbookRemoveRequestSchema>;

export const WordbookRemoveResponseSchema = z
	.object({
		error: NullableStringSchema,
		removed: z.boolean(),
	})
	.readonly();
export type WordbookRemoveResponse = z.infer<
	typeof WordbookRemoveResponseSchema
>;

export const WordbookUpdateRequestSchema = z
	.object({
		lemma: z.string(),
		patch: WordbookUpdatePatchSchema,
		type: z.literal(WORDBOOK_UPDATE_MESSAGE_TYPE),
	})
	.readonly();
export type WordbookUpdateRequest = z.infer<typeof WordbookUpdateRequestSchema>;

export const WordbookUpdateResponseSchema = z
	.object({
		entry: WordbookEntrySchema.nullable(),
		error: NullableStringSchema,
		updated: z.boolean(),
	})
	.readonly();
export type WordbookUpdateResponse = z.infer<
	typeof WordbookUpdateResponseSchema
>;
