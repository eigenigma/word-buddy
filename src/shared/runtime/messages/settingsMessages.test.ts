import { describe, expect, it } from "vitest";

import {
	SETTINGS_GET_MESSAGE_TYPE,
	SETTINGS_SET_MESSAGE_TYPE,
	SettingsGetRequestSchema,
	SettingsGetResponseSchema,
	SettingsSetRequestSchema,
	SettingsSetResponseSchema,
} from "./settingsMessages";

const VALID_SETTINGS = {
	apiKey: "sk-test",
	endpoint: "https://example.com/v1/chat/completions",
	model: "gpt-test",
} as const;

const ACCEPT_CASES = [
	[
		"settings get request",
		SettingsGetRequestSchema,
		{ type: SETTINGS_GET_MESSAGE_TYPE },
	],
	[
		"settings get response",
		SettingsGetResponseSchema,
		{ settings: VALID_SETTINGS },
	],
	[
		"settings get response with empty endpoint",
		SettingsGetResponseSchema,
		{ settings: { ...VALID_SETTINGS, endpoint: "" } },
	],
	[
		"settings set request",
		SettingsSetRequestSchema,
		{ settings: VALID_SETTINGS, type: SETTINGS_SET_MESSAGE_TYPE },
	],
	[
		"settings set response",
		SettingsSetResponseSchema,
		{ settings: VALID_SETTINGS },
	],
	[
		"settings set request with empty endpoint",
		SettingsSetRequestSchema,
		{
			settings: { ...VALID_SETTINGS, endpoint: "" },
			type: SETTINGS_SET_MESSAGE_TYPE,
		},
	],
] as const;

const REJECT_CASES = [
	[
		"settings get request",
		SettingsGetRequestSchema,
		{ type: SETTINGS_SET_MESSAGE_TYPE },
	],
	[
		"settings get response",
		SettingsGetResponseSchema,
		{ settings: { ...VALID_SETTINGS, model: 1 } },
	],
	[
		"settings set request",
		SettingsSetRequestSchema,
		{ settings: VALID_SETTINGS, type: SETTINGS_GET_MESSAGE_TYPE },
	],
	[
		"settings set response",
		SettingsSetResponseSchema,
		{ settings: { ...VALID_SETTINGS, apiKey: null } },
	],
	[
		"settings get response",
		SettingsGetResponseSchema,
		{ settings: { ...VALID_SETTINGS, endpoint: "not a url" } },
	],
] as const;

describe("settings message schemas valid cases", () => {
	it.each(ACCEPT_CASES)("accepts valid %s", (_name, schema, value) => {
		expect(schema.parse(value)).toEqual(value);
	});
});

describe("settings message schemas invalid cases", () => {
	it.each(REJECT_CASES)("rejects invalid %s", (_name, schema, value) => {
		expect(() => schema.parse(value)).toThrow();
	});
});
