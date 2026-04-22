import type { LlmSettings } from "@/shared/settings/types";

import type { SettingsStorage } from "./storage";

export interface SettingsServiceDependencies {
	readonly storage: SettingsStorage;
}

export interface SettingsService {
	readonly get: () => Promise<LlmSettings>;
	readonly set: (settings: LlmSettings) => Promise<LlmSettings>;
}

function trimSettings(settings: LlmSettings): LlmSettings {
	return {
		apiKey: settings.apiKey.trim(),
		endpoint: settings.endpoint.trim(),
		model: settings.model.trim(),
	};
}

export function createSettingsService(
	dependencies: SettingsServiceDependencies,
): SettingsService {
	return {
		get: async (): Promise<LlmSettings> =>
			await dependencies.storage.readSettings(),
		set: async (settings: LlmSettings): Promise<LlmSettings> => {
			const trimmedSettings = trimSettings(settings);
			await dependencies.storage.writeSettings(trimmedSettings);
			return trimmedSettings;
		},
	};
}
