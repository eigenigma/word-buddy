import {
	requestLookup,
	requestNormalize,
} from "@/shared/runtime/dictionaryClient";
import type { DictionaryLookupResult } from "@/shared/runtime/messages/dictionaryMessages";
import {
	requestWordbookAdd,
	requestWordbookExists,
} from "@/shared/runtime/wordbookClient";

export interface ResolvedSelectionPopupState {
	readonly alreadyAdded: boolean;
	readonly context: string;
	readonly entry: DictionaryLookupResult | null;
	readonly lemma: string;
	readonly original: string;
}

interface ResolveSelectionPopupStateInput {
	readonly context: string;
	readonly original: string;
}

interface AddResolvedSelectionToWordbookInput {
	readonly addedAt: number;
	readonly popupState: ResolvedSelectionPopupState;
	readonly sourceUrl: string;
}

interface PopupStateWithLemma {
	readonly lemma: string;
}

interface BubbleUiStateLike {
	readonly kind: "bubble";
}

type PopupUiStateLike<TPopupState extends PopupStateWithLemma> =
	| {
			readonly kind: "card";
			readonly popup: TPopupState;
	  }
	| BubbleUiStateLike
	| null;

export type AddResolvedSelectionToWordbookResult =
	| {
			readonly error: string;
			readonly popupState: null;
	  }
	| {
			readonly error: null;
			readonly popupState: ResolvedSelectionPopupState;
	  };

export function hasActiveCardPopup<TPopupState extends PopupStateWithLemma>(
	currentUiState: PopupUiStateLike<TPopupState>,
	lemma: string,
): boolean {
	return (
		currentUiState?.kind === "card" && currentUiState.popup.lemma === lemma
	);
}

export function getCurrentPopupState<TPopupState extends PopupStateWithLemma>(
	currentUiState: PopupUiStateLike<TPopupState>,
): TPopupState | null {
	return currentUiState?.kind === "card" ? currentUiState.popup : null;
}

function createFallbackLemma(original: string): string | null {
	const trimmedOriginal = original.trim();
	if (trimmedOriginal.length === 0) {
		return null;
	}

	return trimmedOriginal.toLowerCase();
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
}: AddResolvedSelectionToWordbookInput): Promise<AddResolvedSelectionToWordbookResult> {
	const response = await requestWordbookAdd(
		createWordbookAddInput({
			addedAt: addedAt,
			popupState: popupState,
			sourceUrl: sourceUrl,
		}),
	);

	if (response.error) {
		return {
			error: response.error,
			popupState: null,
		};
	}

	return {
		error: null,
		popupState: {
			...popupState,
			alreadyAdded: true,
		},
	};
}

export async function resolveSelectionPopupState({
	context,
	original,
}: ResolveSelectionPopupStateInput): Promise<ResolvedSelectionPopupState | null> {
	if (!original) {
		return null;
	}

	const { entry: exactEntry } = await requestLookup(original);

	if (exactEntry) {
		const { exists } = await requestWordbookExists(exactEntry.word);

		return {
			alreadyAdded: exists,
			context: context,
			entry: exactEntry,
			lemma: exactEntry.word,
			original: original,
		};
	}

	const { lemma } = await requestNormalize(original);
	const nextLemma = lemma ?? createFallbackLemma(original);

	if (!nextLemma) {
		return null;
	}

	const [{ entry }, { exists }] = await Promise.all([
		requestLookup(nextLemma),
		requestWordbookExists(nextLemma),
	]);

	return {
		alreadyAdded: exists,
		context: context,
		entry: entry,
		lemma: nextLemma,
		original: original,
	};
}
