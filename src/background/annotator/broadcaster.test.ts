import { describe, expect, it, vi } from "vitest";

import { ANNOTATOR_SITE_CONTROL_CHANGED_MESSAGE_TYPE } from "@/shared/runtime/messages/annotatorMessages";

import { createAnnotatorBroadcaster } from "./broadcaster";

describe("createAnnotatorBroadcaster", () => {
	it("broadcasts invalidation to every tab and ignores send errors", async () => {
		const sentTabIds: number[] = [];
		const broadcaster = createAnnotatorBroadcaster({
			tabs: {
				queryAll: async () => [{ id: 1 }, { id: 2 }, { id: 3 }],
				sendToTab: async (tabId: number): Promise<void> => {
					sentTabIds.push(tabId);
					if (tabId === 2) {
						throw new Error("no receiver");
					}
				},
			},
		});

		await broadcaster.invalidate();
		expect(sentTabIds).toEqual([1, 2, 3]);
	});

	it("broadcasts site-control changes and reports send failures", async () => {
		const reportErrorMock = vi.fn();
		vi.stubGlobal("reportError", reportErrorMock);
		const broadcaster = createAnnotatorBroadcaster({
			tabs: {
				queryAll: async () => [{ id: 7 }],
				sendToTab: async (tabId: number, message: unknown): Promise<void> => {
					if (tabId !== 7) {
						throw new Error("unexpected tab");
					}
					expect(message).toEqual({
						type: ANNOTATOR_SITE_CONTROL_CHANGED_MESSAGE_TYPE,
					});
					throw new Error("site control receiver missing");
				},
			},
		});

		await broadcaster.siteControlChanged();
		expect(reportErrorMock).toHaveBeenCalledTimes(1);
		expect(reportErrorMock.mock.calls[0]?.[0]).toHaveProperty(
			"message",
			"word-buddy: annotator broadcast failed: site control receiver missing",
		);
	});
});
