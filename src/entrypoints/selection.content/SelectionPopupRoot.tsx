import type { ReadonlySignal } from "@preact/signals";
import type { JSX } from "preact";

import { PopupCard } from "./PopupCard";
import type { SelectionUiState } from "./state";

export interface SelectionPopupRootProps {
	readonly onAdd: () => void;
	readonly onClose: () => void;
	readonly onOpen: () => void;
	readonly state: ReadonlySignal<SelectionUiState | null>;
}

function SelectionBubble({
	onOpen,
	resolving,
}: {
	readonly onOpen: () => void;
	readonly resolving: boolean;
}): JSX.Element {
	return (
		<button
			aria-label="Show word details"
			className="flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white font-semibold text-[11px] text-slate-700 tracking-wide shadow-lg transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
			disabled={resolving}
			onClick={onOpen}
			type="button"
		>
			{resolving ? "..." : "WB"}
		</button>
	);
}

export function SelectionPopupRoot({
	onAdd,
	onClose,
	onOpen,
	state,
}: SelectionPopupRootProps): JSX.Element | null {
	const uiState = state.value;

	if (uiState === null) {
		return null;
	}

	if (uiState.kind === "bubble") {
		return <SelectionBubble onOpen={onOpen} resolving={uiState.resolving} />;
	}

	return (
		<PopupCard
			addError={uiState.addError}
			onAdd={onAdd}
			onClose={onClose}
			popup={uiState.popup}
		/>
	);
}
