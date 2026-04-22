import { z } from "zod";

import { LlmSettingsSchema } from "@/shared/settings/types";

export const SETTINGS_GET_MESSAGE_TYPE = "wordBuddy.settings.get" as const;
export const SETTINGS_SET_MESSAGE_TYPE = "wordBuddy.settings.set" as const;

export const SettingsGetRequestSchema = z
	.object({
		type: z.literal(SETTINGS_GET_MESSAGE_TYPE),
	})
	.readonly();
export type SettingsGetRequest = z.infer<typeof SettingsGetRequestSchema>;

export const SettingsGetResponseSchema = z
	.object({
		settings: LlmSettingsSchema,
	})
	.readonly();
export type SettingsGetResponse = z.infer<typeof SettingsGetResponseSchema>;

export const SettingsSetRequestSchema = z
	.object({
		settings: LlmSettingsSchema,
		type: z.literal(SETTINGS_SET_MESSAGE_TYPE),
	})
	.readonly();
export type SettingsSetRequest = z.infer<typeof SettingsSetRequestSchema>;

export const SettingsSetResponseSchema = z
	.object({
		settings: LlmSettingsSchema,
	})
	.readonly();
export type SettingsSetResponse = z.infer<typeof SettingsSetResponseSchema>;
