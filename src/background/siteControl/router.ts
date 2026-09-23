import type { BackgroundServices } from "@/background/composition";
import {
	type SiteControlIsBlockedRequest,
	SiteControlIsBlockedRequestSchema,
	type SiteControlIsBlockedResponse,
	SiteControlListRequestSchema,
	type SiteControlListResponse,
	type SiteControlSetRequest,
	SiteControlSetRequestSchema,
	type SiteControlSetResponse,
} from "@/shared/runtime/messages/index";

import {
	broadcastSiteControlChanged,
	defineMessageHandler,
	type MessageHandler,
} from "../routerCore";

const siteControlListHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
	): Promise<SiteControlListResponse> => ({
		state: {
			blockedHosts: await services.siteControlService.listBlockedHosts(),
		},
	}),
	requestSchema: SiteControlListRequestSchema,
});

const siteControlIsBlockedHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
		request: SiteControlIsBlockedRequest,
	): Promise<SiteControlIsBlockedResponse> => ({
		blocked: await services.siteControlService.isHostBlocked(request.host),
	}),
	requestSchema: SiteControlIsBlockedRequestSchema,
});

const siteControlSetHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
		request: SiteControlSetRequest,
	): Promise<SiteControlSetResponse> => {
		const state = await services.siteControlService.setHostBlocked(
			request.host,
			request.blocked,
		);
		broadcastSiteControlChanged(services);
		return { state: state };
	},
	requestSchema: SiteControlSetRequestSchema,
});

export const siteControlMessageHandlers: readonly MessageHandler[] = [
	siteControlListHandler,
	siteControlIsBlockedHandler,
	siteControlSetHandler,
];
