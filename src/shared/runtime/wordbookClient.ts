import {
	WORDBOOK_ADD_MESSAGE_TYPE,
	WORDBOOK_EXISTS_MESSAGE_TYPE,
	WORDBOOK_LIST_MESSAGE_TYPE,
	WORDBOOK_REMOVE_MESSAGE_TYPE,
	WORDBOOK_UPDATE_MESSAGE_TYPE,
	type WordbookAddRequest,
	type WordbookAddResponse,
	WordbookAddResponseSchema,
	type WordbookExistsRequest,
	type WordbookExistsResponse,
	WordbookExistsResponseSchema,
	type WordbookListRequest,
	type WordbookListResponse,
	WordbookListResponseSchema,
	type WordbookRemoveRequest,
	type WordbookRemoveResponse,
	WordbookRemoveResponseSchema,
	type WordbookUpdateRequest,
	type WordbookUpdateResponse,
	WordbookUpdateResponseSchema,
} from "@/shared/runtime/messages/index";
import { createMessageClient } from "@/shared/runtime/sendTypedMessage";
import type {
	WordbookEntry,
	WordbookUpdatePatch,
} from "@/shared/wordbook/types";

const sendWordbookAddRequest = createMessageClient<
	WordbookAddRequest,
	WordbookAddResponse
>({
	responseSchema: WordbookAddResponseSchema,
	type: WORDBOOK_ADD_MESSAGE_TYPE,
});

const sendWordbookExistsRequest = createMessageClient<
	WordbookExistsRequest,
	WordbookExistsResponse
>({
	responseSchema: WordbookExistsResponseSchema,
	type: WORDBOOK_EXISTS_MESSAGE_TYPE,
});

const sendWordbookListRequest = createMessageClient<
	WordbookListRequest,
	WordbookListResponse
>({
	responseSchema: WordbookListResponseSchema,
	type: WORDBOOK_LIST_MESSAGE_TYPE,
});

const sendWordbookRemoveRequest = createMessageClient<
	WordbookRemoveRequest,
	WordbookRemoveResponse
>({
	responseSchema: WordbookRemoveResponseSchema,
	type: WORDBOOK_REMOVE_MESSAGE_TYPE,
});

const sendWordbookUpdateRequest = createMessageClient<
	WordbookUpdateRequest,
	WordbookUpdateResponse
>({
	responseSchema: WordbookUpdateResponseSchema,
	type: WORDBOOK_UPDATE_MESSAGE_TYPE,
});

export async function requestWordbookAdd(
	input: WordbookEntry,
): Promise<WordbookAddResponse> {
	return await sendWordbookAddRequest({ input: input });
}

export async function requestWordbookExists(
	lemma: string,
): Promise<WordbookExistsResponse> {
	return await sendWordbookExistsRequest({ lemma: lemma });
}

export async function requestWordbookList(): Promise<WordbookListResponse> {
	return await sendWordbookListRequest();
}

export async function requestWordbookRemove(
	lemma: string,
): Promise<WordbookRemoveResponse> {
	return await sendWordbookRemoveRequest({ lemma: lemma });
}

export async function requestWordbookUpdate(
	lemma: string,
	patch: WordbookUpdatePatch,
): Promise<WordbookUpdateResponse> {
	return await sendWordbookUpdateRequest({
		lemma: lemma,
		patch: patch,
	});
}
