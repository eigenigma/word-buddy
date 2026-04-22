import {
	EMPTY_LLM_SETTINGS,
	type LlmSettings,
	LlmSettingsSchema,
} from "@/shared/settings/types";
import { reportGlobalError } from "@/shared/utils/errors";

const LLM_SETTINGS_STORAGE_KEY = "wordBuddy.settings.llm";

export interface SettingsStorage {
	readonly readSettings: () => Promise<LlmSettings>;
	readonly writeSettings: (settings: LlmSettings) => Promise<void>;
}

function reportInvalidSettings(value: unknown): void {
	reportGlobalError(
		"Invalid LLM settings in storage",
		new Error(JSON.stringify(value)),
	);
}

export function createBrowserStorageSettingsStorage(): SettingsStorage {
	return {
		readSettings: async (): Promise<LlmSettings> => {
			const storedValues = await browser.storage.local.get({
				[LLM_SETTINGS_STORAGE_KEY]: EMPTY_LLM_SETTINGS,
			});
			const settings = storedValues[LLM_SETTINGS_STORAGE_KEY];
			const parsedSettings = LlmSettingsSchema.safeParse(settings);

			if (parsedSettings.success) {
				return parsedSettings.data;
			}

			reportInvalidSettings(settings);
			return EMPTY_LLM_SETTINGS;
		},
		writeSettings: async (settings: LlmSettings): Promise<void> => {
			const parsedSettings = LlmSettingsSchema.safeParse(settings);
			if (!parsedSettings.success) {
				throw new Error(
					`Invalid LLM settings for storage write: ${parsedSettings.error.message}`,
				);
			}

			await browser.storage.local.set({
				[LLM_SETTINGS_STORAGE_KEY]: parsedSettings.data,
			});
		},
	};
}
