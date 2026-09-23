import { useSignal } from "@preact/signals";
import type { JSX } from "preact";
import { useEffect } from "preact/hooks";

import type { TextInputEvent } from "@/shared/dom/events";
import type { WordbookEntry } from "@/shared/wordbook/types";

import { formatTimestamp } from "../format";
import {
	clearDeletion,
	clearEditing,
	pendingDeletionLemma,
	requestDeletion,
	requestEditing,
	wordbookEditingLemma,
} from "../state";
import { removeWordbookEntry, updateWordbookEntry } from "../wordbookData";
import {
	ActionCell,
	ContextCell,
	LemmaCell,
	SourceCell,
	type TextareaEvent,
} from "./WordbookRowCells";

export interface WordbookRowProps {
	readonly entry: WordbookEntry;
}

interface WordbookRowState {
	readonly cancelEdit: () => void;
	readonly draftContext: string;
	readonly draftOriginal: string;
	readonly isEditing: boolean;
	readonly isPendingDeletion: boolean;
	readonly isSaving: boolean;
	readonly onContextInput: (event: TextareaEvent) => void;
	readonly onOriginalInput: (event: TextInputEvent) => void;
	readonly onRequestDeletion: () => void;
	readonly onRequestEditing: () => void;
	readonly onSave: () => Promise<void>;
	readonly onSubmitDeletion: () => Promise<void>;
}

function getRowClassName(
	isEditing: boolean,
	isPendingDeletion: boolean,
): string {
	if (isEditing) {
		return "align-top bg-sky-50";
	}

	return isPendingDeletion ? "align-top bg-rose-50" : "align-top";
}

function resetDrafts(
	entry: WordbookEntry,
	draftOriginal: { value: string },
	draftContext: { value: string },
): void {
	draftOriginal.value = entry.original;
	draftContext.value = entry.context ?? "";
}

async function confirmWordbookDeletion(lemma: string): Promise<void> {
	try {
		await removeWordbookEntry(lemma);
	} finally {
		clearDeletion();
	}
}

function useWordbookRowState(entry: WordbookEntry): WordbookRowState {
	const isEditing = wordbookEditingLemma.value === entry.lemma;
	const isPendingDeletion = pendingDeletionLemma.value === entry.lemma;
	const draftOriginal = useSignal(entry.original);
	const draftContext = useSignal(entry.context ?? "");
	const isSaving = useSignal(false);

	useEffect(() => {
		if (!isEditing) {
			return;
		}

		resetDrafts(entry, draftOriginal, draftContext);
	}, [draftContext, draftOriginal, entry, isEditing]);

	return {
		cancelEdit: (): void => {
			resetDrafts(entry, draftOriginal, draftContext);
			clearEditing();
		},
		draftContext: draftContext.value,
		draftOriginal: draftOriginal.value,
		isEditing: isEditing,
		isPendingDeletion: isPendingDeletion,
		isSaving: isSaving.value,
		onContextInput: (event: TextareaEvent): void => {
			draftContext.value = event.currentTarget.value;
		},
		onOriginalInput: (event: TextInputEvent): void => {
			draftOriginal.value = event.currentTarget.value;
		},
		onRequestDeletion: (): void => {
			requestDeletion(entry.lemma);
		},
		onRequestEditing: (): void => {
			requestEditing(entry.lemma);
		},
		onSave: (): Promise<void> => {
			isSaving.value = true;
			return updateWordbookEntry(entry.lemma, {
				context: draftContext.value === "" ? null : draftContext.value,
				original: draftOriginal.value,
			})
				.then((): void => {
					clearEditing();
				})
				.finally((): void => {
					isSaving.value = false;
				});
		},
		onSubmitDeletion: (): Promise<void> => confirmWordbookDeletion(entry.lemma),
	};
}

export function WordbookRow({ entry }: WordbookRowProps): JSX.Element {
	const state = useWordbookRowState(entry);

	return (
		<tr className={getRowClassName(state.isEditing, state.isPendingDeletion)}>
			<LemmaCell
				draftOriginal={state.draftOriginal}
				entry={entry}
				isEditing={state.isEditing}
				onOriginalInput={state.onOriginalInput}
			/>
			<td className="p-4 text-slate-600 text-sm">
				{formatTimestamp(entry.addedAt)}
			</td>
			<SourceCell entry={entry} />
			<ContextCell
				draftContext={state.draftContext}
				entry={entry}
				isEditing={state.isEditing}
				onContextInput={state.onContextInput}
			/>
			<ActionCell
				isEditing={state.isEditing}
				isPendingDeletion={state.isPendingDeletion}
				isSaving={state.isSaving}
				onCancelEdit={state.cancelEdit}
				onConfirmDeletion={state.onSubmitDeletion}
				onRequestDeletion={state.onRequestDeletion}
				onRequestEditing={state.onRequestEditing}
				onSave={state.onSave}
			/>
		</tr>
	);
}
