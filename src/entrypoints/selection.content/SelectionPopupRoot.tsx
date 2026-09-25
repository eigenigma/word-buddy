import type { JSX } from "preact";

import { PopupCard } from "./PopupCard";
import {
	addError,
	popupState,
	resolveInFlight,
	type SelectionPopupState,
} from "./state";

interface SelectionPopupRootProps {
	readonly onAdd: () => void;
	readonly onClose: () => void;
	readonly onOpen: () => void;
}

function SelectionBubble({
	onOpen,
}: {
	readonly onOpen: () => void;
}): JSX.Element {
	const isResolving = resolveInFlight.value;

	return (
		<button
			aria-label="Show word details"
			className="flex size-10 items-center justify-center rounded-full border border-slate-200 bg-white font-semibold text-[11px] text-slate-700 tracking-wide shadow-lg transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-70"
			disabled={isResolving}
			onClick={onOpen}
			type="button"
		>
			{isResolving ? "..." : "WB"}
		</button>
	);
}

function SelectionCard({
	onAdd,
	onClose,
	popup,
}: {
	readonly onAdd: () => void;
	readonly onClose: () => void;
	readonly popup: SelectionPopupState;
}): JSX.Element {
	return (
		<PopupCard
			addError={addError.value}
			alreadyAdded={popup.alreadyAdded}
			entry={popup.entry}
			lemma={popup.lemma}
			onAdd={onAdd}
			onClose={onClose}
			original={popup.original}
		/>
	);
}

export function SelectionPopupRoot({
	onAdd,
	onClose,
	onOpen,
}: SelectionPopupRootProps): JSX.Element | null {
	const uiState = popupState.value;

	if (uiState === null) {
		return null;
	}

	if (uiState.kind === "bubble") {
		return <SelectionBubble onOpen={onOpen} />;
	}

	return (
		<SelectionCard onAdd={onAdd} onClose={onClose} popup={uiState.popup} />
	);
}
