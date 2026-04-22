import { describe, expect, it } from "vitest";

import {
	DICTIONARY_EXPAND_LEMMAS_MESSAGE_TYPE,
	DICTIONARY_LOOKUP_MESSAGE_TYPE,
	DictionaryExpandLemmasRequestSchema,
	DictionaryExpandLemmasResponseSchema,
	DictionaryLookupRequestSchema,
	DictionaryLookupResponseSchema,
	LEMMA_NORMALIZE_MESSAGE_TYPE,
	LemmaNormalizeRequestSchema,
	LemmaNormalizeResponseSchema,
	STATIC_DICTIONARY_SEED_STATUS_MESSAGE_TYPE,
	StaticDictionarySeedStatusRequestSchema,
	StaticDictionarySeedStatusResponseSchema,
} from "./dictionaryMessages";

const VALID_LOOKUP_ENTRY = {
	definition: "desc",
	frequency: {
		bnc: 1,
		collins: 2,
		frq: 3,
		oxford: true,
		tags: ["tag"],
	},
	phonetic: "/a/",
	pos: "n.",
	translation: "译",
	word: "agenda",
} as const;

const ACCEPT_CASES = [
	[
		"static dictionary seed status request",
		StaticDictionarySeedStatusRequestSchema,
		{ type: STATIC_DICTIONARY_SEED_STATUS_MESSAGE_TYPE },
	],
	[
		"static dictionary seed status response",
		StaticDictionarySeedStatusResponseSchema,
		{
			dictCount: 1,
			hasSeedState: true,
			lastAction: "seeded",
			lastError: null,
			lemmaCount: 2,
		},
	],
	[
		"dictionary lookup request",
		DictionaryLookupRequestSchema,
		{ type: DICTIONARY_LOOKUP_MESSAGE_TYPE, word: "agenda" },
	],
	[
		"dictionary lookup response",
		DictionaryLookupResponseSchema,
		{ entry: VALID_LOOKUP_ENTRY },
	],
	[
		"lemma normalize request",
		LemmaNormalizeRequestSchema,
		{ surface: "running", type: LEMMA_NORMALIZE_MESSAGE_TYPE },
	],
	["lemma normalize response", LemmaNormalizeResponseSchema, { lemma: "run" }],
	[
		"expand lemmas request",
		DictionaryExpandLemmasRequestSchema,
		{ lemmas: ["run", "agenda"], type: DICTIONARY_EXPAND_LEMMAS_MESSAGE_TYPE },
	],
	[
		"expand lemmas response",
		DictionaryExpandLemmasResponseSchema,
		{ expansions: { run: ["run", "running"] } },
	],
] as const;

const REJECT_CASES = [
	[
		"static dictionary seed status request",
		StaticDictionarySeedStatusRequestSchema,
		{ type: "wrong" },
	],
	[
		"static dictionary seed status response",
		StaticDictionarySeedStatusResponseSchema,
		{
			dictCount: "1",
			hasSeedState: true,
			lastAction: "seeded",
			lastError: null,
			lemmaCount: 2,
		},
	],
	[
		"dictionary lookup request",
		DictionaryLookupRequestSchema,
		{ type: DICTIONARY_LOOKUP_MESSAGE_TYPE, word: 1 },
	],
	[
		"dictionary lookup response",
		DictionaryLookupResponseSchema,
		{
			entry: {
				...VALID_LOOKUP_ENTRY,
				frequency: { ...VALID_LOOKUP_ENTRY.frequency, tags: [1] },
			},
		},
	],
	[
		"lemma normalize request",
		LemmaNormalizeRequestSchema,
		{ surface: null, type: LEMMA_NORMALIZE_MESSAGE_TYPE },
	],
	["lemma normalize response", LemmaNormalizeResponseSchema, { lemma: 1 }],
	[
		"expand lemmas request",
		DictionaryExpandLemmasRequestSchema,
		{ lemmas: ["run", 1], type: DICTIONARY_EXPAND_LEMMAS_MESSAGE_TYPE },
	],
	[
		"expand lemmas response",
		DictionaryExpandLemmasResponseSchema,
		{ expansions: { run: ["run", 1] } },
	],
] as const;

describe("dictionary message schemas", () => {
	it.each(ACCEPT_CASES)("accepts valid %s", (_name, schema, value) => {
		expect(schema.parse(value)).toEqual(value);
	});

	it.each(REJECT_CASES)("rejects invalid %s", (_name, schema, value) => {
		expect(() => schema.parse(value)).toThrow();
	});
});
