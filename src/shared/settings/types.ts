import { z } from "zod";

export interface LlmSettings {
	readonly apiKey: string;
	readonly endpoint: string;
	readonly model: string;
}

export const LlmSettingsSchema: z.ZodType<LlmSettings> = z
	.object({
		apiKey: z.string(),
		endpoint: z.union([z.string().url(), z.literal("")]),
		model: z.string(),
	})
	.readonly();

export const EMPTY_LLM_SETTINGS: LlmSettings = Object.freeze({
	apiKey: "",
	endpoint: "",
	model: "",
});

export function isSettingsComplete(settings: LlmSettings): boolean {
	return (
		settings.apiKey.trim().length > 0 &&
		settings.endpoint.trim().length > 0 &&
		settings.model.trim().length > 0
	);
}
