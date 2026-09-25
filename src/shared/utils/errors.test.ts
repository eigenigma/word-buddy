import { describe, expect, it, vi } from "vitest";

import { reportGlobalError, toErrorMessage } from "./errors";

describe("toErrorMessage", () => {
	it("returns the message for Error instances", () => {
		expect(toErrorMessage(new Error("boom"))).toBe("boom");
	});

	it("stringifies non-Error values", () => {
		expect(toErrorMessage({ detail: "boom" })).toBe("[object Object]");
	});
});

describe("reportGlobalError", () => {
	it("forwards the formatted error to globalThis.reportError when available", () => {
		const reportErrorMock = vi.fn();
		vi.stubGlobal("reportError", reportErrorMock);

		reportGlobalError("word-buddy: test", new Error("boom"));

		expect(reportErrorMock).toHaveBeenCalledTimes(1);
		expect(reportErrorMock.mock.calls[0]?.[0]).toBeInstanceOf(Error);
		expect(reportErrorMock.mock.calls[0]?.[0]).toHaveProperty(
			"message",
			"word-buddy: test: boom",
		);
	});

	it("does nothing when globalThis.reportError is unavailable", () => {
		vi.stubGlobal("reportError", undefined);

		expect(() => {
			reportGlobalError("word-buddy: test", new Error("boom"));
		}).not.toThrow();
	});
});
