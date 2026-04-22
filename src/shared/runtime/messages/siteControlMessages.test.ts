import { describe, expect, it } from "vitest";

import {
	SITE_CONTROL_IS_BLOCKED_MESSAGE_TYPE,
	SITE_CONTROL_LIST_MESSAGE_TYPE,
	SITE_CONTROL_SET_MESSAGE_TYPE,
	SiteControlIsBlockedRequestSchema,
	SiteControlIsBlockedResponseSchema,
	SiteControlListRequestSchema,
	SiteControlListResponseSchema,
	SiteControlSetRequestSchema,
	SiteControlSetResponseSchema,
} from "./siteControlMessages";

const VALID_STATE = { blockedHosts: ["example.com"] } as const;
const ACCEPT_CASES = [
	[
		"list request",
		SiteControlListRequestSchema,
		{ type: SITE_CONTROL_LIST_MESSAGE_TYPE },
	],
	["list response", SiteControlListResponseSchema, { state: VALID_STATE }],
	[
		"is-blocked request",
		SiteControlIsBlockedRequestSchema,
		{ host: "EXAMPLE.COM", type: SITE_CONTROL_IS_BLOCKED_MESSAGE_TYPE },
	],
	[
		"is-blocked response",
		SiteControlIsBlockedResponseSchema,
		{ blocked: true },
	],
	[
		"set request",
		SiteControlSetRequestSchema,
		{ blocked: true, host: "EXAMPLE.COM", type: SITE_CONTROL_SET_MESSAGE_TYPE },
	],
	["set response", SiteControlSetResponseSchema, { state: VALID_STATE }],
] as const;
const REJECT_CASES = [
	[
		"list request",
		SiteControlListRequestSchema,
		{ type: SITE_CONTROL_SET_MESSAGE_TYPE },
	],
	[
		"list response",
		SiteControlListResponseSchema,
		{ state: { blockedHosts: [1] } },
	],
	[
		"list response",
		SiteControlListResponseSchema,
		{ state: { blockedHosts: ["EXAMPLE.COM"] } },
	],
	[
		"list response",
		SiteControlListResponseSchema,
		{ state: { blockedHosts: ["www.example.com"] } },
	],
	[
		"is-blocked request",
		SiteControlIsBlockedRequestSchema,
		{ host: 1, type: SITE_CONTROL_IS_BLOCKED_MESSAGE_TYPE },
	],
	[
		"is-blocked response",
		SiteControlIsBlockedResponseSchema,
		{ blocked: "true" },
	],
	[
		"set request",
		SiteControlSetRequestSchema,
		{
			blocked: "true",
			host: "example.com",
			type: SITE_CONTROL_SET_MESSAGE_TYPE,
		},
	],
	[
		"set response",
		SiteControlSetResponseSchema,
		{ state: { blockedHosts: [null] } },
	],
] as const;

describe("site control message schemas valid cases", () => {
	it.each(ACCEPT_CASES)("accepts valid %s", (_name, schema, value) => {
		expect(schema.parse(value)).toEqual(value);
	});
});

describe("site control message schemas invalid cases", () => {
	it.each(REJECT_CASES)("rejects invalid %s", (_name, schema, value) => {
		expect(() => schema.parse(value)).toThrow();
	});
});
