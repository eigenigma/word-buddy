import {
	DICTIONARY_EXPAND_LEMMAS_MESSAGE_TYPE,
	DICTIONARY_RESOLVE_MESSAGE_TYPE,
	type DictionaryExpandLemmasRequest,
	type DictionaryExpandLemmasResponse,
	DictionaryExpandLemmasResponseSchema,
	type DictionaryResolveRequest,
	type DictionaryResolveResponse,
	DictionaryResolveResponseSchema,
} from "@/shared/runtime/messages/index";

import { createMessageClient } from "@/shared/runtime/sendTypedMessage";

const sendExpandLemmasRequest = createMessageClient<
	DictionaryExpandLemmasRequest,
	DictionaryExpandLemmasResponse
>({
	responseSchema: DictionaryExpandLemmasResponseSchema,
	type: DICTIONARY_EXPAND_LEMMAS_MESSAGE_TYPE,
});

const sendResolveRequest = createMessageClient<
	DictionaryResolveRequest,
	DictionaryResolveResponse
>({
	responseSchema: DictionaryResolveResponseSchema,
	type: DICTIONARY_RESOLVE_MESSAGE_TYPE,
});

export async function requestExpandLemmas(
	lemmas: readonly string[],
): Promise<DictionaryExpandLemmasResponse> {
	return await sendExpandLemmasRequest({ lemmas: lemmas });
}

export async function requestResolve(
	selection: string,
): Promise<DictionaryResolveResponse> {
	return await sendResolveRequest({ selection: selection });
}
