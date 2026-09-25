import type { BackgroundServices } from "@/background/composition";
import type { DictionaryResolution } from "@/background/dictionary/resolveService";
import type { DictionaryEntry } from "@/shared/dictionary/types";
import {
	type DictionaryExpandLemmasRequest,
	DictionaryExpandLemmasRequestSchema,
	type DictionaryExpandLemmasResponse,
	type DictionaryLookupResult,
	type DictionaryResolveRequest,
	DictionaryResolveRequestSchema,
	type DictionaryResolveResponse,
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

function toResolutionResult(
	resolution: DictionaryResolution,
): NonNullable<DictionaryResolveResponse["resolution"]> {
	return {
		entry: resolution.entry === null ? null : toLookupResult(resolution.entry),
		lemma: resolution.lemma,
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

const dictionaryResolveHandler = defineMessageHandler({
	handle: async (
		services: BackgroundServices,
		request: DictionaryResolveRequest,
	): Promise<DictionaryResolveResponse> => {
		const resolution = await services.dictionaryResolveService.resolve(
			request.selection,
		);
		return {
			resolution: resolution === null ? null : toResolutionResult(resolution),
		};
	},
	requestSchema: DictionaryResolveRequestSchema,
});

export const dictionaryMessageHandlers: readonly MessageHandler[] = [
	dictionaryExpandLemmasHandler,
	dictionaryResolveHandler,
];
