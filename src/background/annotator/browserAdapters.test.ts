import { assert, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnnotatorBroadcasterDependencies } from "@/background/annotator/broadcaster";

import { createAnnotatorBrowserAdapter } from "./browserAdapters";

const {
	ANNOTATOR_BROADCASTER,
	browserTabsQueryMock,
	browserTabsSendMessageMock,
	createAnnotatorBroadcasterMock,
} = vi.hoisted(() => ({
	ANNOTATOR_BROADCASTER: { id: "annotator" },
	browserTabsQueryMock: vi.fn(),
	browserTabsSendMessageMock: vi.fn(),
	createAnnotatorBroadcasterMock:
		vi.fn<(dependencies: AnnotatorBroadcasterDependencies) => unknown>(),
}));

vi.mock("@/background/annotator/broadcaster", () => ({
	createAnnotatorBroadcaster: createAnnotatorBroadcasterMock,
}));

beforeEach(() => {
	vi.resetAllMocks();
	createAnnotatorBroadcasterMock.mockReturnValue(ANNOTATOR_BROADCASTER);
	vi.stubGlobal("browser", {
		tabs: {
			query: browserTabsQueryMock,
			sendMessage: browserTabsSendMessageMock,
		},
	});
});

describe("createAnnotatorBrowserAdapter", () => {
	it("returns the annotator broadcaster", () => {
		expect(createAnnotatorBrowserAdapter()).toBe(ANNOTATOR_BROADCASTER);
	});
});

describe("annotator broadcaster wiring", () => {
	it("routes tab helpers through browser.tabs", async () => {
		browserTabsQueryMock.mockResolvedValue([{ id: 1 }, { id: undefined }]);
		createAnnotatorBrowserAdapter();

		const dependencies = createAnnotatorBroadcasterMock.mock.lastCall?.[0];
		assert.isDefined(dependencies);

		await expect(dependencies.tabs.queryAll()).resolves.toEqual([{ id: 1 }]);
		await dependencies.tabs.sendToTab(1, { type: "ping" });
		expect(browserTabsQueryMock).toHaveBeenCalledWith({
			url: ["http://*/*", "https://*/*"],
		});
		expect(browserTabsSendMessageMock).toHaveBeenCalledWith(1, {
			type: "ping",
		});
	});
});
