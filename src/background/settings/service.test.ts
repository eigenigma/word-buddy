import { describe, expect, it } from "vitest";

import {
	EMPTY_LLM_SETTINGS,
	type LlmSettings,
} from "../../shared/settings/types";

import { createSettingsService } from "./service";
import type { SettingsStorage } from "./storage";

function createInMemorySettingsStorage(): SettingsStorage {
	const storage = new Map<string, LlmSettings>();

	return {
		readSettings: async (): Promise<LlmSettings> =>
			storage.get("settings") ?? EMPTY_LLM_SETTINGS,
		writeSettings: async (settings: LlmSettings): Promise<void> => {
			storage.set("settings", settings);
		},
	};
}

describe("createSettingsService", () => {
	it("returns empty settings, trims saved values, and round-trips persisted settings", async () => {
		const service = createSettingsService({
			storage: createInMemorySettingsStorage(),
		});

		await expect(service.get()).resolves.toBe(EMPTY_LLM_SETTINGS);

		const savedSettings = await service.set({
			apiKey: "  sk-test  ",
			endpoint: "  https://example.com/v1/chat/completions  ",
			model: "  gpt-test  ",
		});
		expect(savedSettings).toEqual({
			apiKey: "sk-test",
			endpoint: "https://example.com/v1/chat/completions",
			model: "gpt-test",
		});

		const roundTrippedSettings = await service.get();
		expect(roundTrippedSettings).toEqual(savedSettings);
		expect(typeof roundTrippedSettings.apiKey).toBe("string");
		expect(typeof roundTrippedSettings.endpoint).toBe("string");
		expect(typeof roundTrippedSettings.model).toBe("string");
	});
});
