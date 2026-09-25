import type { BackgroundServices } from "@/background/composition";
import {
	type DictionaryExpandLemmasRequest,
	DictionaryExpandLemmasRequestSchema,
	type DictionaryExpandLemmasResponse,
	type DictionaryResolveRequest,
	DictionaryResolveRequestSchema,
	type DictionaryResolveResponse,
} from "@/shared/runtime/messages/index";

import { defineMessageHandler, type MessageHandler } from "../routerCore";

const dictionaryExpandLemmasHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
		request: DictionaryExpandLemmasRequest,
	): Promise<DictionaryExpandLemmasResponse> => ({
		expansions: await services.lemmaExpansionService.expandLemmas(
			request.lemmas,
		),
	}),
	requestSchema: DictionaryExpandLemmasRequestSchema,
});

const dictionaryResolveHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
		request: DictionaryResolveRequest,
	): Promise<DictionaryResolveResponse> => ({
		resolution: await services.dictionaryResolveService.resolve(
			request.selection,
		),
	}),
	requestSchema: DictionaryResolveRequestSchema,
});

export const dictionaryMessageHandlers: readonly MessageHandler[] = [
	dictionaryExpandLemmasHandler,
	dictionaryResolveHandler,
];
