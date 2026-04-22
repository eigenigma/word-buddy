import {
	SETTINGS_GET_MESSAGE_TYPE,
	SETTINGS_SET_MESSAGE_TYPE,
	type SettingsGetRequest,
	type SettingsGetResponse,
	SettingsGetResponseSchema,
	type SettingsSetRequest,
	type SettingsSetResponse,
	SettingsSetResponseSchema,
} from "@/shared/runtime/messages/settingsMessages";
import { createMessageClient } from "@/shared/runtime/sendTypedMessage";
import type { LlmSettings } from "@/shared/settings/types";

const sendSettingsGetRequest = createMessageClient<
	SettingsGetRequest,
	SettingsGetResponse
>({
	responseSchema: SettingsGetResponseSchema,
	type: SETTINGS_GET_MESSAGE_TYPE,
});

const sendSettingsSetRequest = createMessageClient<
	SettingsSetRequest,
	SettingsSetResponse
>({
	responseSchema: SettingsSetResponseSchema,
	type: SETTINGS_SET_MESSAGE_TYPE,
});

export async function requestSettingsGet(): Promise<SettingsGetResponse> {
	return await sendSettingsGetRequest();
}

export async function requestSettingsSet(
	settings: LlmSettings,
): Promise<SettingsSetResponse> {
	return await sendSettingsSetRequest({ settings: settings });
}
