import type { BackgroundServices } from "@/background/composition";
import type { DictionaryEntry } from "@/shared/dictionary/types";
import {
	type DictionaryExpandLemmasRequest,
	DictionaryExpandLemmasRequestSchema,
	type DictionaryExpandLemmasResponse,
	type DictionaryLookupRequest,
	DictionaryLookupRequestSchema,
	type DictionaryLookupResponse,
	type DictionaryLookupResult,
	type LemmaNormalizeRequest,
	LemmaNormalizeRequestSchema,
	type LemmaNormalizeResponse,
} from "@/shared/runtime/messages/index";

import { defineMessageHandler, type MessageHandler } from "../routerCore";

function toLookupResult(entry: DictionaryEntry): DictionaryLookupResult {
	return {
		definition: entry.definition,
		frequency: entry.frequency,
		phonetic: entry.phonetic,
		pos: entry.pos,
		translation: entry.translation,
		word: entry.word,
	};
}

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

const dictionaryLookupHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
		request: DictionaryLookupRequest,
	): Promise<DictionaryLookupResponse> => {
		const entry = await services.dictionaryQueryService.lookupExactWord(
			request.word,
		);
		return {
			entry: entry === null ? null : toLookupResult(entry),
		};
	},
	requestSchema: DictionaryLookupRequestSchema,
});

const lemmaNormalizeHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
		request: LemmaNormalizeRequest,
	): Promise<LemmaNormalizeResponse> => ({
		lemma: await services.dictionaryQueryService.normalizeSurface(
			request.surface,
		),
	}),
	requestSchema: LemmaNormalizeRequestSchema,
});

export const dictionaryMessageHandlers: readonly MessageHandler[] = [
	dictionaryExpandLemmasHandler,
	dictionaryLookupHandler,
	lemmaNormalizeHandler,
];
