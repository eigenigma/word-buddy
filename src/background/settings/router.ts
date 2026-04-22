import type { BackgroundServices } from "@/background/composition";
import {
	type SettingsGetRequest,
	SettingsGetRequestSchema,
	type SettingsGetResponse,
	type SettingsSetRequest,
	SettingsSetRequestSchema,
	type SettingsSetResponse,
} from "@/shared/runtime/messages/index";

import type { HandlerDescriptor } from "../routerCore";

const settingsGetHandler: HandlerDescriptor<
	SettingsGetRequest,
	SettingsGetResponse
> = {
	handle: async (
		services: BackgroundServices,
		_request: SettingsGetRequest,
	): Promise<SettingsGetResponse> => ({
		settings: await services.settingsService.get(),
	}),
	requestSchema: SettingsGetRequestSchema,
};

const settingsSetHandler: HandlerDescriptor<
	SettingsSetRequest,
	SettingsSetResponse
> = {
	handle: async (
		services: BackgroundServices,
		request: SettingsSetRequest,
	): Promise<SettingsSetResponse> => ({
		settings: await services.settingsService.set(request.settings),
	}),
	requestSchema: SettingsSetRequestSchema,
};

export const settingsHandlerDescriptors = [
	settingsGetHandler,
	settingsSetHandler,
] as const;
