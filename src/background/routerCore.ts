import type { ZodType } from "zod";

import type { BackgroundServices } from "@/background/composition";
import type {
	DictionaryExpandLemmasResponse,
	DictionaryResolveResponse,
	LlmTranslateParagraphResponse,
	LlmTranslationCacheClearResponse,
	SettingsGetResponse,
	SettingsSetResponse,
	SiteControlIsBlockedResponse,
	SiteControlListResponse,
	SiteControlSetResponse,
	WordbookAddResponse,
	WordbookExistsResponse,
	WordbookListResponse,
	WordbookRemoveResponse,
	WordbookUpdateResponse,
} from "@/shared/runtime/messages/index";
import { reportGlobalError, toErrorMessage } from "@/shared/utils/errors";

export type BackgroundResponsePayload =
	| DictionaryExpandLemmasResponse
	| DictionaryResolveResponse
	| LlmTranslateParagraphResponse
	| LlmTranslationCacheClearResponse
	| SettingsGetResponse
	| SettingsSetResponse
	| SiteControlIsBlockedResponse
	| SiteControlListResponse
	| SiteControlSetResponse
	| WordbookAddResponse
	| WordbookExistsResponse
	| WordbookListResponse
	| WordbookRemoveResponse
	| WordbookUpdateResponse;

export type BackgroundMessageResponse =
	| Promise<BackgroundResponsePayload>
	| false;

export interface MessageRouter {
	readonly handle: (message: unknown) => BackgroundMessageResponse;
}

interface HandlerDescriptor<Req, Res extends BackgroundResponsePayload> {
	readonly requestSchema: ZodType<Req>;
	readonly handle: (services: BackgroundServices, request: Req) => Promise<Res>;
}

export type MessageHandler = (
	services: BackgroundServices,
	message: unknown,
) => Promise<BackgroundResponsePayload> | null;

export function defineMessageHandler<
	Req,
	Res extends BackgroundResponsePayload,
>(descriptor: HandlerDescriptor<Req, Res>): MessageHandler {
	return (
		services: BackgroundServices,
		message: unknown,
	): Promise<Res> | null => {
		const parsedMessage = descriptor.requestSchema.safeParse(message);
		if (!parsedMessage.success) {
			return null;
		}

		return descriptor.handle(services, parsedMessage.data);
	};
}

export function reportBackgroundError(context: string, error: unknown): void {
	reportGlobalError(context, error);
}

type BroadcastServices = Pick<BackgroundServices, "annotatorBroadcaster">;

export function broadcastInvalidation(services: BroadcastServices): void {
	services.annotatorBroadcaster.invalidate().catch((error: unknown): void => {
		reportBackgroundError("word-buddy: annotator invalidation failed", error);
	});
}

export function broadcastSiteControlChanged(services: BroadcastServices): void {
	services.annotatorBroadcaster
		.siteControlChanged()
		.catch((error: unknown): void => {
			reportBackgroundError("word-buddy: site control broadcast failed", error);
		});
}

export async function withErrorEnvelope<TSuccess, TResponse>(
	handler: () => Promise<TSuccess>,
	onSuccess: (result: TSuccess) => TResponse,
	onError: (errorMessage: string) => TResponse,
): Promise<TResponse> {
	try {
		return onSuccess(await handler());
	} catch (error: unknown) {
		return onError(toErrorMessage(error));
	}
}
