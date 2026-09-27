import type { DictionaryResolution } from "@/shared/dictionary/types";
import type { SelectionSnapshot } from "@/shared/dom/selection";

export interface SelectionPopupState extends DictionaryResolution {
	readonly alreadyAdded: boolean;
	readonly context: string;
	readonly original: string;
}

export interface SelectionBubbleUiState {
	readonly kind: "bubble";
	readonly resolving: boolean;
	readonly selection: SelectionSnapshot;
}

export interface SelectionCardUiState {
	readonly addError: string | null;
	readonly adding: boolean;
	readonly anchor: DOMRect;
	readonly kind: "card";
	readonly popup: SelectionPopupState;
}

export type SelectionUiState = SelectionBubbleUiState | SelectionCardUiState;
