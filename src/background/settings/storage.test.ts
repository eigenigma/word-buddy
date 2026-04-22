import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EMPTY_LLM_SETTINGS, type LlmSettings } from "@/shared/settings/types";

import { createBrowserStorageSettingsStorage } from "./storage";

const STORAGE_KEY = "wordBuddy.settings.llm";
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
	} as unknown as typeof browser);
});

afterEach(() => {
	vi.restoreAllMocks();
	Reflect.deleteProperty(globalThis, "reportError");
});

describe("createBrowserStorageSettingsStorage", () => {
	it("returns valid settings from browser storage", async () => {
		const storedSettings: LlmSettings = {
			apiKey: "sk-test",
			endpoint: "https://example.com/v1/chat/completions",
			model: "gpt-4.1-mini",
		};
		getStorageMock.mockResolvedValue({
			[STORAGE_KEY]: storedSettings,
		});

		const storage = createBrowserStorageSettingsStorage();

		await expect(storage.readSettings()).resolves.toEqual(storedSettings);
		expect(getStorageMock).toHaveBeenCalledWith({
			[STORAGE_KEY]: EMPTY_LLM_SETTINGS,
		});
	});

	it("reports invalid stored settings and falls back to EMPTY_LLM_SETTINGS", async () => {
		const reportErrorMock = vi.fn();
		vi.stubGlobal("reportError", reportErrorMock);
		getStorageMock.mockResolvedValue({
			[STORAGE_KEY]: {
				apiKey: 1,
			},
		});

		const storage = createBrowserStorageSettingsStorage();
		const settings = await storage.readSettings();

		expect(settings).toEqual(EMPTY_LLM_SETTINGS);
		expect(reportErrorMock).toHaveBeenCalledTimes(1);
		expect((reportErrorMock.mock.calls[0]?.[0] as Error).message).toContain(
			"Invalid LLM settings in storage",
		);
	});

	it.each([
		{
			apiKey: "sk-test",
			endpoint: "https://example.com/v1/chat/completions",
			model: "gpt-4.1-mini",
		},
		{
			apiKey: "sk-test",
			endpoint: "",
			model: "gpt-4.1-mini",
		},
	] satisfies readonly LlmSettings[])("writes valid settings back through browser.storage.local.set", async (storedSettings) => {
		const storage = createBrowserStorageSettingsStorage();

		await storage.writeSettings(storedSettings);

		expect(setStorageMock).toHaveBeenCalledWith({
			[STORAGE_KEY]: storedSettings,
		});
	});

	it("throws before writing invalid settings to browser storage", async () => {
		const storage = createBrowserStorageSettingsStorage();

		await expect(
			storage.writeSettings({
				apiKey: "",
				endpoint: "not a url",
				model: "",
			}),
		).rejects.toThrow("Invalid LLM settings for storage write");
		expect(setStorageMock).not.toHaveBeenCalled();
	});
});
