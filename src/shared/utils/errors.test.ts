import { describe, expect, it } from "vitest";

import { toErrorMessage } from "./errors";

describe("toErrorMessage", () => {
	it("returns the message for Error instances", () => {
		expect(toErrorMessage(new Error("boom"))).toBe("boom");
	});

	it("stringifies non-Error values", () => {
		expect(toErrorMessage({ detail: "boom" })).toBe("[object Object]");
	});
});
