import type { BackgroundServices } from "@/background/composition";
import {
	SettingsGetRequestSchema,
	type SettingsGetResponse,
	type SettingsSetRequest,
	SettingsSetRequestSchema,
	type SettingsSetResponse,
} from "@/shared/runtime/messages/index";

import { defineMessageHandler, type MessageHandler } from "../routerCore";

const settingsGetHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
	): Promise<SettingsGetResponse> => ({
		settings: await services.settingsService.get(),
	}),
	requestSchema: SettingsGetRequestSchema,
});

const settingsSetHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
		request: SettingsSetRequest,
	): Promise<SettingsSetResponse> => ({
		settings: await services.settingsService.set(request.settings),
	}),
	requestSchema: SettingsSetRequestSchema,
});

export const settingsMessageHandlers: readonly MessageHandler[] = [
	settingsGetHandler,
	settingsSetHandler,
];
