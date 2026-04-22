import {
	SITE_CONTROL_IS_BLOCKED_MESSAGE_TYPE,
	SITE_CONTROL_LIST_MESSAGE_TYPE,
	SITE_CONTROL_SET_MESSAGE_TYPE,
	type SiteControlIsBlockedRequest,
	type SiteControlIsBlockedResponse,
	SiteControlIsBlockedResponseSchema,
	type SiteControlListRequest,
	type SiteControlListResponse,
	SiteControlListResponseSchema,
	type SiteControlSetRequest,
	type SiteControlSetResponse,
	SiteControlSetResponseSchema,
} from "@/shared/runtime/messages/siteControlMessages";
import { createMessageClient } from "@/shared/runtime/sendTypedMessage";

const sendSiteControlListRequest = createMessageClient<
	SiteControlListRequest,
	SiteControlListResponse
>({
	responseSchema: SiteControlListResponseSchema,
	type: SITE_CONTROL_LIST_MESSAGE_TYPE,
});

const sendSiteControlIsBlockedRequest = createMessageClient<
	SiteControlIsBlockedRequest,
	SiteControlIsBlockedResponse
>({
	responseSchema: SiteControlIsBlockedResponseSchema,
	type: SITE_CONTROL_IS_BLOCKED_MESSAGE_TYPE,
});

const sendSiteControlSetRequest = createMessageClient<
	SiteControlSetRequest,
	SiteControlSetResponse
>({
	responseSchema: SiteControlSetResponseSchema,
	type: SITE_CONTROL_SET_MESSAGE_TYPE,
});

export async function requestSiteControlList(): Promise<SiteControlListResponse> {
	return await sendSiteControlListRequest();
}

export async function requestSiteControlIsBlocked(
	host: string,
): Promise<SiteControlIsBlockedResponse> {
	return await sendSiteControlIsBlockedRequest({ host: host });
}

export async function requestSiteControlSet(
	host: string,
	blocked: boolean,
): Promise<SiteControlSetResponse> {
	return await sendSiteControlSetRequest({
		blocked: blocked,
		host: host,
	});
}
