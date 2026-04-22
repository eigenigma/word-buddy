import { signal } from "@preact/signals";

import type { SelectionSnapshot } from "@/shared/dom/selection";
import type { DictionaryLookupResult } from "@/shared/runtime/messages/dictionaryMessages";

export interface SelectionPopupState {
	readonly alreadyAdded: boolean;
	readonly context: string;
	readonly entry: DictionaryLookupResult | null;
	readonly lemma: string;
	readonly original: string;
}

export interface SelectionBubbleUiState {
	readonly kind: "bubble";
	readonly selection: SelectionSnapshot;
}

export interface SelectionCardUiState {
	readonly kind: "card";
	readonly popup: SelectionPopupState;
}

export type SelectionUiState = SelectionBubbleUiState | SelectionCardUiState;

export const popupState = signal<SelectionUiState | null>(null);
export const addError = signal<string | null>(null);
export const addInFlight = signal(false);
export const resolveInFlight = signal(false);

export function resetPopupTransientState(): void {
	addError.value = null;
	addInFlight.value = false;
	resolveInFlight.value = false;
}
