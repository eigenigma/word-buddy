import { z } from "zod";

import { SiteControlStateSchema } from "@/shared/siteControl/types";

export const SITE_CONTROL_LIST_MESSAGE_TYPE =
	"wordBuddy.siteControl.list" as const;
export const SITE_CONTROL_IS_BLOCKED_MESSAGE_TYPE =
	"wordBuddy.siteControl.isHostBlocked" as const;
export const SITE_CONTROL_SET_MESSAGE_TYPE =
	"wordBuddy.siteControl.setHostBlocked" as const;

export const SiteControlListRequestSchema = z
	.object({
		type: z.literal(SITE_CONTROL_LIST_MESSAGE_TYPE),
	})
	.readonly();
export type SiteControlListRequest = z.infer<
	typeof SiteControlListRequestSchema
>;

export const SiteControlListResponseSchema = z
	.object({
		state: SiteControlStateSchema,
	})
	.readonly();
export type SiteControlListResponse = z.infer<
	typeof SiteControlListResponseSchema
>;

export const SiteControlIsBlockedRequestSchema = z
	.object({
		host: z.string(),
		type: z.literal(SITE_CONTROL_IS_BLOCKED_MESSAGE_TYPE),
	})
	.readonly();
export type SiteControlIsBlockedRequest = z.infer<
	typeof SiteControlIsBlockedRequestSchema
>;

export const SiteControlIsBlockedResponseSchema = z
	.object({
		blocked: z.boolean(),
	})
	.readonly();
export type SiteControlIsBlockedResponse = z.infer<
	typeof SiteControlIsBlockedResponseSchema
>;

export const SiteControlSetRequestSchema = z
	.object({
		blocked: z.boolean(),
		host: z.string(),
		type: z.literal(SITE_CONTROL_SET_MESSAGE_TYPE),
	})
	.readonly();
export type SiteControlSetRequest = z.infer<typeof SiteControlSetRequestSchema>;

export const SiteControlSetResponseSchema = z
	.object({
		state: SiteControlStateSchema,
	})
	.readonly();
export type SiteControlSetResponse = z.infer<
	typeof SiteControlSetResponseSchema
>;
