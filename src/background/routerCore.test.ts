import { describe, expect, it, vi } from "vitest";

import type { BackgroundServices } from "@/background/composition";

import {
	broadcastInvalidation,
	broadcastSiteControlChanged,
	withErrorEnvelope,
} from "./routerCore";

function createBroadcastServices(
	overrides: {
		readonly invalidate?: () => Promise<void>;
		readonly siteControlChanged?: () => Promise<void>;
	} = {},
): Pick<BackgroundServices, "annotatorBroadcaster"> {
	return {
		annotatorBroadcaster: {
			invalidate:
				overrides.invalidate ?? (async (): Promise<void> => undefined),
			siteControlChanged:
				overrides.siteControlChanged ?? (async (): Promise<void> => undefined),
		},
	};
}

describe("broadcast helpers", () => {
	it("reports invalidation broadcast failures", async () => {
		const reportErrorMock = vi.fn();
		vi.stubGlobal("reportError", reportErrorMock);

		broadcastInvalidation(
			createBroadcastServices({
				invalidate: async (): Promise<void> => {
					throw new Error("invalidate failed");
				},
			}),
		);
		await Promise.resolve();

		expect(reportErrorMock.mock.calls[0]?.[0]).toHaveProperty(
			"message",
			"word-buddy: annotator invalidation failed: invalidate failed",
		);
	});

	it("reports site-control broadcast failures", async () => {
		const reportErrorMock = vi.fn();
		vi.stubGlobal("reportError", reportErrorMock);

		broadcastSiteControlChanged(
			createBroadcastServices({
				siteControlChanged: async (): Promise<void> => {
					throw new Error("site control failed");
				},
			}),
		);
		await Promise.resolve();

		expect(reportErrorMock.mock.calls[0]?.[0]).toHaveProperty(
			"message",
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
