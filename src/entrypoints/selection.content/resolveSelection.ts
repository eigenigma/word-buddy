import { requestResolve } from "@/shared/runtime/dictionaryClient";
import {
	requestWordbookAdd,
	requestWordbookExists,
} from "@/shared/runtime/wordbookClient";

import type { SelectionPopupState } from "./state";

interface ResolveSelectionPopupStateInput {
	readonly context: string;
	readonly original: string;
}

interface AddResolvedSelectionToWordbookInput {
	readonly addedAt: number;
	readonly popupState: SelectionPopupState;
	readonly sourceUrl: string;
}

function createWordbookAddInput({
	addedAt,
	popupState,
	sourceUrl,
}: AddResolvedSelectionToWordbookInput): Parameters<
	typeof requestWordbookAdd
>[0] {
	return {
		addedAt: addedAt,
		context: popupState.context,
		lemma: popupState.lemma,
		original: popupState.original,
		sourceUrl: sourceUrl,
	};
}

export async function addResolvedSelectionToWordbook({
	addedAt,
	popupState,
	sourceUrl,
}: AddResolvedSelectionToWordbookInput): Promise<void> {
	const response = await requestWordbookAdd(
		createWordbookAddInput({
			addedAt: addedAt,
			popupState: popupState,
			sourceUrl: sourceUrl,
		}),
	);

	if (response.error) {
		throw new Error(response.error);
	}
}

export async function resolveSelectionPopupState({
	context,
	original,
}: ResolveSelectionPopupStateInput): Promise<SelectionPopupState | null> {
	if (!original) {
		return null;
	}

	const { resolution } = await requestResolve(original);
	if (resolution === null) {
		return null;
	}

	const { exists } = await requestWordbookExists(resolution.lemma);

	return {
		alreadyAdded: exists,
		context: context,
		entry: resolution.entry,
		lemma: resolution.lemma,
		original: original,
	};
}
