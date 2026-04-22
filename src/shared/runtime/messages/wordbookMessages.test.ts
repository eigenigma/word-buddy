import { describe, expect, it } from "vitest";

import {
	WORDBOOK_ADD_MESSAGE_TYPE,
	WORDBOOK_EXISTS_MESSAGE_TYPE,
	WORDBOOK_LIST_MESSAGE_TYPE,
	WORDBOOK_REMOVE_MESSAGE_TYPE,
	WORDBOOK_UPDATE_MESSAGE_TYPE,
	WordbookAddRequestSchema,
	WordbookAddResponseSchema,
	WordbookExistsRequestSchema,
	WordbookExistsResponseSchema,
	WordbookListRequestSchema,
	WordbookListResponseSchema,
	WordbookRemoveRequestSchema,
	WordbookRemoveResponseSchema,
	WordbookUpdateRequestSchema,
	WordbookUpdateResponseSchema,
} from "./wordbookMessages";

const VALID_ENTRY = {
	addedAt: 1_700_000_000_000,
	context: "ctx",
	lemma: "agenda",
	original: "agenda",
	sourceUrl: "https://example.com/article",
} as const;
const ACCEPT_CASES = [
	[
		"add request",
		WordbookAddRequestSchema,
		{ input: VALID_ENTRY, type: WORDBOOK_ADD_MESSAGE_TYPE },
	],
	["add response", WordbookAddResponseSchema, { added: true, error: null }],
	[
		"exists request",
		WordbookExistsRequestSchema,
		{ lemma: "agenda", type: WORDBOOK_EXISTS_MESSAGE_TYPE },
	],
	["exists response", WordbookExistsResponseSchema, { exists: true }],
	[
		"list request",
		WordbookListRequestSchema,
		{ type: WORDBOOK_LIST_MESSAGE_TYPE },
	],
	["list response", WordbookListResponseSchema, { entries: [VALID_ENTRY] }],
	[
		"remove request",
		WordbookRemoveRequestSchema,
		{ lemma: "agenda", type: WORDBOOK_REMOVE_MESSAGE_TYPE },
	],
	[
		"remove response",
		WordbookRemoveResponseSchema,
		{ error: null, removed: true },
	],
	[
		"update request",
		WordbookUpdateRequestSchema,
		{
			lemma: "agenda",
			patch: { context: null, original: "agenda" },
			type: WORDBOOK_UPDATE_MESSAGE_TYPE,
		},
	],
	[
		"update response",
		WordbookUpdateResponseSchema,
		{ entry: VALID_ENTRY, error: null, updated: true },
	],
] as const;
const REJECT_CASES = [
	[
		"add request",
		WordbookAddRequestSchema,
		{
			input: { ...VALID_ENTRY, addedAt: Number.POSITIVE_INFINITY },
			type: WORDBOOK_ADD_MESSAGE_TYPE,
		},
	],
	["add response", WordbookAddResponseSchema, { added: true, error: 1 }],
	[
		"exists request",
		WordbookExistsRequestSchema,
		{ lemma: null, type: WORDBOOK_EXISTS_MESSAGE_TYPE },
	],
	["exists response", WordbookExistsResponseSchema, { exists: "true" }],
	[
		"list request",
		WordbookListRequestSchema,
		{ type: WORDBOOK_REMOVE_MESSAGE_TYPE },
	],
	[
		"list response",
		WordbookListResponseSchema,
		{ entries: [{ ...VALID_ENTRY, sourceUrl: 1 }] },
	],
	[
		"remove request",
		WordbookRemoveRequestSchema,
		{ lemma: 1, type: WORDBOOK_REMOVE_MESSAGE_TYPE },
	],
	[
		"remove response",
		WordbookRemoveResponseSchema,
		{ error: null, removed: "true" },
	],
	[
		"update request",
		WordbookUpdateRequestSchema,
		{
			lemma: "agenda",
			patch: { context: 1 },
			type: WORDBOOK_UPDATE_MESSAGE_TYPE,
		},
	],
	[
		"update response",
		WordbookUpdateResponseSchema,
		{ entry: { ...VALID_ENTRY, original: 1 }, error: null, updated: true },
	],
] as const;

describe("wordbook message schemas valid cases", () => {
	it.each(ACCEPT_CASES)("accepts valid %s", (_name, schema, value) => {
		expect(schema.parse(value)).toEqual(value);
	});
});

describe("wordbook message schemas invalid cases", () => {
	it.each(REJECT_CASES)("rejects invalid %s", (_name, schema, value) => {
		expect(() => schema.parse(value)).toThrow();
	});
});
