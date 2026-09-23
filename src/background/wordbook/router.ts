import type { BackgroundServices } from "@/background/composition";
import {
	type WordbookAddRequest,
	WordbookAddRequestSchema,
	type WordbookAddResponse,
	type WordbookExistsRequest,
	WordbookExistsRequestSchema,
	type WordbookExistsResponse,
	WordbookListRequestSchema,
	type WordbookListResponse,
	type WordbookRemoveRequest,
	WordbookRemoveRequestSchema,
	type WordbookRemoveResponse,
	type WordbookUpdateRequest,
	WordbookUpdateRequestSchema,
	type WordbookUpdateResponse,
} from "@/shared/runtime/messages/index";

import {
	broadcastInvalidation,
	defineMessageHandler,
	type MessageHandler,
	withErrorEnvelope,
} from "../routerCore";

const wordbookAddHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
		request: WordbookAddRequest,
	): Promise<WordbookAddResponse> =>
		await withErrorEnvelope(
			async () => await services.wordbookService.addWord(request.input),
			(result): WordbookAddResponse => {
				if (result.added) {
					broadcastInvalidation(services);
				}

				return {
					added: result.added,
					error: null,
				};
			},
			(errorMessage: string): WordbookAddResponse => ({
				added: false,
				error: errorMessage,
			}),
		),
	requestSchema: WordbookAddRequestSchema,
});

const wordbookExistsHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
		request: WordbookExistsRequest,
	): Promise<WordbookExistsResponse> => ({
		exists: await services.wordbookService.existsByLemma(request.lemma),
	}),
	requestSchema: WordbookExistsRequestSchema,
});

const wordbookListHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
	): Promise<WordbookListResponse> => ({
		entries: await services.wordbookService.listAll(),
	}),
	requestSchema: WordbookListRequestSchema,
});

const wordbookRemoveHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
		request: WordbookRemoveRequest,
	): Promise<WordbookRemoveResponse> =>
		await withErrorEnvelope(
			async () => await services.wordbookService.removeByLemma(request.lemma),
			(result): WordbookRemoveResponse => {
				if (result.removed) {
					broadcastInvalidation(services);
				}

				return {
					error: null,
					removed: result.removed,
				};
			},
			(errorMessage: string): WordbookRemoveResponse => ({
				error: errorMessage,
				removed: false,
			}),
		),
	requestSchema: WordbookRemoveRequestSchema,
});

const wordbookUpdateHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
		request: WordbookUpdateRequest,
	): Promise<WordbookUpdateResponse> =>
		await withErrorEnvelope(
			async () =>
				await services.wordbookService.updateEntry(
					request.lemma,
					request.patch,
				),
			(result): WordbookUpdateResponse => ({
				entry: result.entry,
				error: null,
				updated: result.updated,
			}),
			(errorMessage: string): WordbookUpdateResponse => ({
				entry: null,
				error: errorMessage,
				updated: false,
			}),
		),
	requestSchema: WordbookUpdateRequestSchema,
});

export const wordbookMessageHandlers: readonly MessageHandler[] = [
	wordbookAddHandler,
	wordbookExistsHandler,
	wordbookListHandler,
	wordbookRemoveHandler,
	wordbookUpdateHandler,
];
