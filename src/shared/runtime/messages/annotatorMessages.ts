import { z } from "zod";

export const ANNOTATOR_INVALIDATE_MESSAGE_TYPE =
	"wordBuddy.annotator.invalidate" as const;
export const ANNOTATOR_SITE_CONTROL_CHANGED_MESSAGE_TYPE =
	"wordBuddy.annotator.siteControlChanged" as const;

export const AnnotatorInvalidateRequestSchema = z
	.object({
		type: z.literal(ANNOTATOR_INVALIDATE_MESSAGE_TYPE),
	})
	.readonly();
export type AnnotatorInvalidateRequest = z.infer<
	typeof AnnotatorInvalidateRequestSchema
>;

export const AnnotatorSiteControlChangedRequestSchema = z
	.object({
		type: z.literal(ANNOTATOR_SITE_CONTROL_CHANGED_MESSAGE_TYPE),
	})
	.readonly();
export type AnnotatorSiteControlChangedRequest = z.infer<
	typeof AnnotatorSiteControlChangedRequestSchema
>;
