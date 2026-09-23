import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	EMPTY_SITE_CONTROL_STATE,
	type SiteControlState,
} from "@/shared/siteControl/types";

import { createBrowserStorageSiteControl } from "./storage";

const STORAGE_KEY = "wordBuddy.siteControl";
const getStorageMock = vi.fn();
const setStorageMock = vi.fn();

beforeEach(() => {
	getStorageMock.mockReset();
	setStorageMock.mockReset();
	vi.stubGlobal("browser", {
		storage: {
			local: {
				get: getStorageMock,
				set: setStorageMock,
			},
		},
	});
});

afterEach(() => {
	vi.restoreAllMocks();
	Reflect.deleteProperty(globalThis, "reportError");
});

describe("createBrowserStorageSiteControl", () => {
	it("returns a cloned blocked-host list from browser storage", async () => {
		const storedState: SiteControlState = {
			blockedHosts: ["example.com", "another.example"],
		};
		getStorageMock.mockResolvedValue({
			[STORAGE_KEY]: storedState,
		});

		const storage = createBrowserStorageSiteControl();
		const state = await storage.readSiteControl();

		expect(state).toEqual(storedState);
		expect(state.blockedHosts).not.toBe(storedState.blockedHosts);
		expect(getStorageMock).toHaveBeenCalledWith({
			[STORAGE_KEY]: EMPTY_SITE_CONTROL_STATE,
		});
	});

	it("reports invalid stored state and falls back to EMPTY_SITE_CONTROL_STATE", async () => {
		const reportErrorMock = vi.fn();
		vi.stubGlobal("reportError", reportErrorMock);
		getStorageMock.mockResolvedValue({
			[STORAGE_KEY]: {
				blockedHosts: [1],
			},
		});

		const storage = createBrowserStorageSiteControl();
		const state = await storage.readSiteControl();

		expect(state).toEqual(EMPTY_SITE_CONTROL_STATE);
		expect(reportErrorMock).toHaveBeenCalledTimes(1);
		expect(reportErrorMock.mock.calls[0]?.[0]).toHaveProperty(
			"message",
			expect.stringContaining("Invalid site control state in storage"),
		);
	});

	it("writes the updated state through browser.storage.local.set", async () => {
		const storedState: SiteControlState = {
			blockedHosts: ["example.com"],
		};
		const storage = createBrowserStorageSiteControl();

		await storage.writeSiteControl(storedState);

		expect(setStorageMock).toHaveBeenCalledWith({
			[STORAGE_KEY]: storedState,
		});
	});

	it.each([
		["uppercase host", ["EXAMPLE.COM"]],
		["non-canonical www host", ["www.example.com"]],
	])(
		"throws before writing invalid state to browser storage for %s",
		async (_name, blockedHosts) => {
			const storage = createBrowserStorageSiteControl();

			await expect(
				storage.writeSiteControl({
					blockedHosts: blockedHosts,
				}),
			).rejects.toThrow("Invalid site control state for storage write");
			expect(setStorageMock).not.toHaveBeenCalled();
		},
	);
});
