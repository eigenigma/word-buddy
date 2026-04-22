import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SiteControlState } from "@/shared/siteControl/types";

type SiteControlDataModule = typeof import("./siteControlData");

const { requestSiteControlListMock, requestSiteControlSetMock } = vi.hoisted(
	() => ({
		requestSiteControlListMock: vi.fn(),
		requestSiteControlSetMock: vi.fn(),
	}),
);

vi.mock("@/shared/runtime/siteControlClient", () => ({
	requestSiteControlList: requestSiteControlListMock,
	requestSiteControlSet: requestSiteControlSetMock,
}));

const TEST_SITE_CONTROL_STATE: SiteControlState = {
	blockedHosts: ["example.com"],
};

let siteControlData: SiteControlDataModule;

beforeEach(async () => {
	requestSiteControlListMock.mockReset();
	requestSiteControlSetMock.mockReset();
	siteControlData = await import("./siteControlData");
	siteControlData.siteControlPanelState.value = { kind: "loading" };
});

describe("loadSiteControl", () => {
	it("loads the blocked hosts into the ready state", async () => {
		requestSiteControlListMock.mockResolvedValue({
			state: TEST_SITE_CONTROL_STATE,
		});

		await siteControlData.loadSiteControl();

		expect(siteControlData.siteControlPanelState.value).toEqual({
			kind: "ready",
			state: TEST_SITE_CONTROL_STATE,
		});
	});

	it("stores an error state when loading fails", async () => {
		requestSiteControlListMock.mockRejectedValue(
			new Error("site control load failed"),
		);

		await siteControlData.loadSiteControl();

		expect(siteControlData.siteControlPanelState.value).toEqual({
			kind: "error",
			message: "site control load failed",
		});
	});
});

describe("setHostBlocked", () => {
	it("writes the updated blocked host list into the ready state", async () => {
		requestSiteControlSetMock.mockResolvedValue({
			state: {
				blockedHosts: ["example.com", "another.example"],
			},
		});

		await siteControlData.setHostBlocked("another.example", true);

		expect(requestSiteControlSetMock).toHaveBeenCalledWith(
			"another.example",
			true,
		);
		expect(siteControlData.siteControlPanelState.value).toEqual({
			kind: "ready",
			state: {
				blockedHosts: ["example.com", "another.example"],
			},
		});
	});

	it("stores an error state when the update fails", async () => {
		requestSiteControlSetMock.mockRejectedValue(
			new Error("site control update failed"),
		);

		await siteControlData.setHostBlocked("example.com", false);

		expect(siteControlData.siteControlPanelState.value).toEqual({
			kind: "error",
			message: "site control update failed",
		});
	});
});
