import { beforeEach, describe, expect, it, vi } from "vitest";

type PopupStateModule = typeof import("./state");

const { requestSiteControlIsBlockedMock, requestSiteControlSetMock } =
	vi.hoisted(() => ({
		requestSiteControlIsBlockedMock: vi.fn(),
		requestSiteControlSetMock: vi.fn(),
	}));

vi.mock("@/shared/runtime/siteControlClient", () => ({
	requestSiteControlIsBlocked: requestSiteControlIsBlockedMock,
	requestSiteControlSet: requestSiteControlSetMock,
}));

const queryTabsMock = vi.fn();

let popupStateModule: PopupStateModule;

beforeEach(async () => {
	requestSiteControlIsBlockedMock.mockReset();
	requestSiteControlSetMock.mockReset();
	queryTabsMock.mockReset();
	vi.stubGlobal("browser", {
		tabs: {
			query: queryTabsMock,
		},
	} as unknown as typeof browser);
	popupStateModule = await import("./state");
	popupStateModule.popupState.value = { kind: "loading" };
});

describe("loadPopup", () => {
	it("returns a ready state with no host when the active tab has no URL", async () => {
		queryTabsMock.mockResolvedValue([{ url: undefined }]);

		await popupStateModule.loadPopup();

		expect(requestSiteControlIsBlockedMock).not.toHaveBeenCalled();
		expect(popupStateModule.popupState.value).toEqual({
			blocked: false,
			host: null,
			kind: "ready",
		});
	});

	it("loads the current host block state for a valid tab URL", async () => {
		queryTabsMock.mockResolvedValue([{ url: "https://example.com/article" }]);
		requestSiteControlIsBlockedMock.mockResolvedValue({ blocked: true });

		await popupStateModule.loadPopup();

		expect(requestSiteControlIsBlockedMock).toHaveBeenCalledWith("example.com");
		expect(popupStateModule.popupState.value).toEqual({
			blocked: true,
			host: "example.com",
			kind: "ready",
		});
	});

	it("stores an error state when the block lookup fails", async () => {
		queryTabsMock.mockResolvedValue([{ url: "https://example.com/article" }]);
		requestSiteControlIsBlockedMock.mockRejectedValue(
			new Error("popup load failed"),
		);

		await popupStateModule.loadPopup();

		expect(popupStateModule.popupState.value).toEqual({
			kind: "error",
			message: "popup load failed",
		});
	});
});

describe("togglePopup", () => {
	it("does nothing when the popup is not ready for toggling", async () => {
		popupStateModule.popupState.value = { kind: "loading" };

		await popupStateModule.togglePopup();

		expect(requestSiteControlSetMock).not.toHaveBeenCalled();
		expect(popupStateModule.popupState.value).toEqual({ kind: "loading" });
	});

	it("updates the ready state from the returned blocked host list", async () => {
		popupStateModule.popupState.value = {
			blocked: false,
			host: "example.com",
			kind: "ready",
		};
		requestSiteControlSetMock.mockResolvedValue({
			state: {
				blockedHosts: ["example.com"],
			},
		});

		await popupStateModule.togglePopup();

		expect(requestSiteControlSetMock).toHaveBeenCalledWith("example.com", true);
		expect(popupStateModule.popupState.value).toEqual({
			blocked: true,
			host: "example.com",
			kind: "ready",
		});
	});

	it("stores an error state when toggling fails", async () => {
		popupStateModule.popupState.value = {
			blocked: true,
			host: "example.com",
			kind: "ready",
		};
		requestSiteControlSetMock.mockRejectedValue(
			new Error("popup toggle failed"),
		);

		await popupStateModule.togglePopup();

		expect(popupStateModule.popupState.value).toEqual({
			kind: "error",
			message: "popup toggle failed",
		});
	});
});
