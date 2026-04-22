import { afterEach, describe, expect, it, vi } from "vitest";

import type { BackgroundServices } from "@/background/composition";

import {
	broadcastInvalidation,
	broadcastSiteControlChanged,
	reportBackgroundError,
	withErrorEnvelope,
} from "./routerCore";

function createServices(
	overrides: {
		readonly invalidate?: () => Promise<void>;
		readonly siteControlChanged?: () => Promise<void>;
	} = {},
): BackgroundServices {
	return {
		annotatorBroadcaster: {
			invalidate:
				overrides.invalidate ?? (async (): Promise<void> => undefined),
			siteControlChanged:
				overrides.siteControlChanged ?? (async (): Promise<void> => undefined),
		},
	} as unknown as BackgroundServices;
}

afterEach(() => {
	vi.restoreAllMocks();
	Reflect.deleteProperty(globalThis, "reportError");
});

describe("reportBackgroundError", () => {
	it("forwards the formatted error to globalThis.reportError when available", () => {
		const reportErrorMock = vi.fn();
		vi.stubGlobal("reportError", reportErrorMock);

		reportBackgroundError("word-buddy: test", new Error("boom"));

		expect(reportErrorMock).toHaveBeenCalledTimes(1);
		expect(reportErrorMock.mock.calls[0]?.[0]).toBeInstanceOf(Error);
		expect((reportErrorMock.mock.calls[0]?.[0] as Error).message).toBe(
			"word-buddy: test: boom",
		);
	});

	it("does nothing when globalThis.reportError is unavailable", () => {
		expect(() => {
			reportBackgroundError("word-buddy: test", new Error("boom"));
		}).not.toThrow();
	});
});

describe("broadcast helpers", () => {
	it("reports invalidation broadcast failures", async () => {
		const reportErrorMock = vi.fn();
		vi.stubGlobal("reportError", reportErrorMock);

		broadcastInvalidation(
			createServices({
				invalidate: async (): Promise<void> => {
					throw new Error("invalidate failed");
				},
			}),
		);
		await Promise.resolve();

		expect((reportErrorMock.mock.calls[0]?.[0] as Error).message).toBe(
			"word-buddy: annotator invalidation failed: invalidate failed",
		);
	});

	it("reports site-control broadcast failures", async () => {
		const reportErrorMock = vi.fn();
		vi.stubGlobal("reportError", reportErrorMock);

		broadcastSiteControlChanged(
			createServices({
				siteControlChanged: async (): Promise<void> => {
					throw new Error("site control failed");
				},
			}),
		);
		await Promise.resolve();

		expect((reportErrorMock.mock.calls[0]?.[0] as Error).message).toBe(
			"word-buddy: site control broadcast failed: site control failed",
		);
	});
});

describe("withErrorEnvelope", () => {
	it("maps successful results through onSuccess", async () => {
		type Envelope =
			| { readonly kind: "success"; readonly result: number }
			| { readonly kind: "error"; readonly message: string };

		await expect(
			withErrorEnvelope(
				async () => 42,
				(result: number): Envelope => ({ kind: "success", result: result }),
				(message: string): Envelope => ({ kind: "error", message: message }),
			),
		).resolves.toEqual({ kind: "success", result: 42 });
	});

	it("maps thrown errors through onError", async () => {
		type Envelope =
			| { readonly kind: "success"; readonly result: number }
			| { readonly kind: "error"; readonly message: string };

		await expect(
			withErrorEnvelope(
				async () => {
					throw new Error("handler failed");
				},
				(result: number): Envelope => ({ kind: "success", result: result }),
				(message: string): Envelope => ({ kind: "error", message: message }),
			),
		).resolves.toEqual({ kind: "error", message: "handler failed" });
	});
});
