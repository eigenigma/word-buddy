import { describe, expect, it } from "vitest";

import {
	DICTIONARY_EXPAND_LEMMAS_MESSAGE_TYPE,
	DICTIONARY_RESOLVE_MESSAGE_TYPE,
	DictionaryExpandLemmasRequestSchema,
	DictionaryExpandLemmasResponseSchema,
	DictionaryResolveRequestSchema,
	DictionaryResolveResponseSchema,
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
		"dictionary resolve request",
		DictionaryResolveRequestSchema,
		{ selection: "Went", type: DICTIONARY_RESOLVE_MESSAGE_TYPE },
	],
	[
		"dictionary resolve response with an entry",
		DictionaryResolveResponseSchema,
		{ resolution: { entry: VALID_LOOKUP_ENTRY, lemma: "agenda" } },
	],
	[
		"dictionary resolve response without an entry",
		DictionaryResolveResponseSchema,
		{ resolution: { entry: null, lemma: "zzz" } },
	],
	[
		"dictionary resolve response without a resolution",
		DictionaryResolveResponseSchema,
		{ resolution: null },
	],
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
		"dictionary resolve request",
		DictionaryResolveRequestSchema,
		{ selection: null, type: DICTIONARY_RESOLVE_MESSAGE_TYPE },
	],
	[
		"dictionary resolve response entry",
		DictionaryResolveResponseSchema,
		{
			resolution: {
				entry: {
					...VALID_LOOKUP_ENTRY,
					frequency: { ...VALID_LOOKUP_ENTRY.frequency, tags: [1] },
				},
				lemma: "agenda",
			},
		},
	],
	[
		"dictionary resolve response lemma",
		DictionaryResolveResponseSchema,
		{ resolution: { entry: null, lemma: null } },
	],
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
