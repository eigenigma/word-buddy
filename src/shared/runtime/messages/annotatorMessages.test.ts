import { describe, expect, it } from "vitest";

import {
	ANNOTATOR_INVALIDATE_MESSAGE_TYPE,
	ANNOTATOR_SITE_CONTROL_CHANGED_MESSAGE_TYPE,
	AnnotatorInvalidateRequestSchema,
	AnnotatorSiteControlChangedRequestSchema,
} from "./annotatorMessages";

describe("annotator message schemas", () => {
	it.each([
		[
			"invalidate request",
			AnnotatorInvalidateRequestSchema,
			{ type: ANNOTATOR_INVALIDATE_MESSAGE_TYPE },
		],
		[
			"site-control-changed request",
			AnnotatorSiteControlChangedRequestSchema,
			{ type: ANNOTATOR_SITE_CONTROL_CHANGED_MESSAGE_TYPE },
		],
	])("accepts valid %s", (_name, schema, value) => {
		expect(schema.parse(value)).toEqual(value);
	});

	it.each([
		[
			"invalidate request",
			AnnotatorInvalidateRequestSchema,
			{ type: ANNOTATOR_SITE_CONTROL_CHANGED_MESSAGE_TYPE },
		],
		[
			"site-control-changed request",
			AnnotatorSiteControlChangedRequestSchema,
			{ type: ANNOTATOR_INVALIDATE_MESSAGE_TYPE },
		],
	])("rejects invalid %s", (_name, schema, value) => {
		expect(() => schema.parse(value)).toThrow();
	});
});
