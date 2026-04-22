import type { BackgroundServices } from "@/background/composition";
import {
	type SiteControlIsBlockedRequest,
	SiteControlIsBlockedRequestSchema,
	type SiteControlIsBlockedResponse,
	type SiteControlListRequest,
	SiteControlListRequestSchema,
	type SiteControlListResponse,
	type SiteControlSetRequest,
	SiteControlSetRequestSchema,
	type SiteControlSetResponse,
} from "@/shared/runtime/messages/index";

import {
	broadcastSiteControlChanged,
	type HandlerDescriptor,
} from "../routerCore";

const siteControlListHandler: HandlerDescriptor<
	SiteControlListRequest,
	SiteControlListResponse
> = {
	handle: async (
		services: BackgroundServices,
		_request: SiteControlListRequest,
	): Promise<SiteControlListResponse> => ({
		state: {
			blockedHosts: await services.siteControlService.listBlockedHosts(),
		},
	}),
	requestSchema: SiteControlListRequestSchema,
};

const siteControlIsBlockedHandler: HandlerDescriptor<
	SiteControlIsBlockedRequest,
	SiteControlIsBlockedResponse
> = {
	handle: async (
		services: BackgroundServices,
		request: SiteControlIsBlockedRequest,
	): Promise<SiteControlIsBlockedResponse> => ({
		blocked: await services.siteControlService.isHostBlocked(request.host),
	}),
	requestSchema: SiteControlIsBlockedRequestSchema,
};

const siteControlSetHandler: HandlerDescriptor<
	SiteControlSetRequest,
	SiteControlSetResponse
> = {
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
};

export const siteControlHandlerDescriptors = [
	siteControlListHandler,
	siteControlIsBlockedHandler,
	siteControlSetHandler,
] as const;
