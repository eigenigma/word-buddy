import {
	DICTIONARY_EXPAND_LEMMAS_MESSAGE_TYPE,
	DICTIONARY_LOOKUP_MESSAGE_TYPE,
	type DictionaryExpandLemmasRequest,
	type DictionaryExpandLemmasResponse,
	DictionaryExpandLemmasResponseSchema,
	type DictionaryLookupRequest,
	type DictionaryLookupResponse,
	DictionaryLookupResponseSchema,
	LEMMA_NORMALIZE_MESSAGE_TYPE,
	type LemmaNormalizeRequest,
	type LemmaNormalizeResponse,
	LemmaNormalizeResponseSchema,
} from "@/shared/runtime/messages/index";

import { createMessageClient } from "@/shared/runtime/sendTypedMessage";

const sendExpandLemmasRequest = createMessageClient<
	DictionaryExpandLemmasRequest,
	DictionaryExpandLemmasResponse
>({
	responseSchema: DictionaryExpandLemmasResponseSchema,
	type: DICTIONARY_EXPAND_LEMMAS_MESSAGE_TYPE,
});

const sendLookupRequest = createMessageClient<
	DictionaryLookupRequest,
	DictionaryLookupResponse
>({
	responseSchema: DictionaryLookupResponseSchema,
	type: DICTIONARY_LOOKUP_MESSAGE_TYPE,
});

const sendNormalizeRequest = createMessageClient<
	LemmaNormalizeRequest,
	LemmaNormalizeResponse
>({
	responseSchema: LemmaNormalizeResponseSchema,
	type: LEMMA_NORMALIZE_MESSAGE_TYPE,
});

export async function requestExpandLemmas(
	lemmas: readonly string[],
): Promise<DictionaryExpandLemmasResponse> {
	return await sendExpandLemmasRequest({ lemmas: lemmas });
}

export async function requestLookup(
	word: string,
): Promise<DictionaryLookupResponse> {
	return await sendLookupRequest({ word: word });
}

export async function requestNormalize(
	surface: string,
): Promise<LemmaNormalizeResponse> {
	return await sendNormalizeRequest({ surface: surface });
}
