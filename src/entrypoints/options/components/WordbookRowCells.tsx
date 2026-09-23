import type { JSX } from "preact";

import type { TextInputEvent } from "@/shared/dom/events";
import { toErrorMessage } from "@/shared/utils/errors";
import type { WordbookEntry } from "@/shared/wordbook/types";

import { formatSourceHost } from "../format";
import {
	clearDeletion,
	wordbookEditError,
	wordbookEntriesState,
} from "../state";

const EMPTY_VALUE = "\u2014";
const INPUT_CLASS_NAME =
	"w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-slate-900 text-sm outline-none transition focus:border-slate-400";
const TEXTAREA_CLASS_NAME = `${INPUT_CLASS_NAME} min-h-24 resize-y leading-6`;

export type TextareaEvent = Event & {
	readonly currentTarget: HTMLTextAreaElement;
};

export interface LemmaCellProps {
	readonly draftOriginal: string;
	readonly entry: WordbookEntry;
	readonly isEditing: boolean;
	readonly onOriginalInput: (event: TextInputEvent) => void;
}

export interface ContextCellProps {
	readonly draftContext: string;
	readonly entry: WordbookEntry;
	readonly isEditing: boolean;
	readonly onContextInput: (event: TextareaEvent) => void;
}

export interface ActionCellProps {
	readonly isEditing: boolean;
	readonly isPendingDeletion: boolean;
	readonly isSaving: boolean;
	readonly onCancelEdit: () => void;
	readonly onConfirmDeletion: () => Promise<void>;
	readonly onRequestDeletion: () => void;
	readonly onRequestEditing: () => void;
	readonly onSave: () => Promise<void>;
}

export function LemmaCell({
	draftOriginal,
	entry,
	isEditing,
	onOriginalInput,
}: LemmaCellProps): JSX.Element {
	if (isEditing) {
		return (
			<td className="p-4">
				<div className="font-semibold text-slate-900 text-sm">
					{entry.lemma}
				</div>
				<input
					className={`${INPUT_CLASS_NAME} mt-2`}
					onInput={onOriginalInput}
					type="text"
					value={draftOriginal}
				/>
			</td>
		);
	}

	return (
		<td className="p-4">
			<div className="font-semibold text-slate-900 text-sm">{entry.lemma}</div>
			{entry.original === entry.lemma ? null : (
				<p className="mt-1 text-slate-500 text-xs">{entry.original}</p>
			)}
		</td>
	);
}

export function SourceCell({
	entry,
}: {
	readonly entry: WordbookEntry;
}): JSX.Element {
	if (entry.sourceUrl === null) {
		return (
			<td className="p-4 text-sm">
				<span className="text-slate-400">{EMPTY_VALUE}</span>
			</td>
		);
	}

	return (
		<td className="p-4 text-sm">
			<a
				className="font-medium text-sky-700 transition hover:text-sky-900 hover:underline"
				href={entry.sourceUrl}
				rel="noreferrer"
				target="_blank"
				title={entry.sourceUrl}
			>
				{formatSourceHost(entry.sourceUrl)}
			</a>
		</td>
	);
}

export function ContextCell({
	draftContext,
	entry,
	isEditing,
	onContextInput,
}: ContextCellProps): JSX.Element {
	if (isEditing) {
		return (
			<td className="p-4">
				<textarea
					className={TEXTAREA_CLASS_NAME}
					onInput={onContextInput}
					value={draftContext}
				/>
			</td>
		);
	}

	if (entry.context === null) {
		return (
			<td className="p-4">
				<span className="text-slate-400">{EMPTY_VALUE}</span>
			</td>
		);
	}

	return (
		<td className="p-4">
			<p
				className="line-clamp-2 max-w-xl text-slate-600 text-sm leading-6"
				title={entry.context}
			>
				{entry.context}
			</p>
		</td>
	);
}

export function ActionCell({
	isEditing,
	isPendingDeletion,
	isSaving,
	onCancelEdit,
	onConfirmDeletion,
	onRequestDeletion,
	onRequestEditing,
	onSave,
}: ActionCellProps): JSX.Element {
	if (isEditing) {
		return (
			<td className="p-4 text-right">
				<div className="flex items-center justify-end gap-2">
					<button
						className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-sm text-white transition hover:bg-slate-800 disabled:border disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
						disabled={isSaving}
						onClick={(): void => {
							onSave().catch((error: unknown): void => {
								wordbookEditError.value = toErrorMessage(error);
							});
						}}
						type="button"
					>
						Save
					</button>
					<button
						className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 text-sm transition hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
						disabled={isSaving}
						onClick={onCancelEdit}
						type="button"
					>
						Cancel
					</button>
				</div>
			</td>
		);
	}

	if (isPendingDeletion) {
		return (
			<td className="p-4 text-right">
				<div className="flex items-center justify-end gap-2">
					<button
						className="rounded-lg bg-rose-600 px-3 py-2 font-medium text-sm text-white transition hover:bg-rose-700"
						onClick={(): void => {
							onConfirmDeletion().catch((error: unknown): void => {
								wordbookEntriesState.value = {
									kind: "error",
									message: toErrorMessage(error),
								};
							});
						}}
						type="button"
					>
						Confirm
					</button>
					<button
						className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 text-sm transition hover:bg-slate-50"
						onClick={clearDeletion}
						type="button"
					>
						Cancel
					</button>
				</div>
			</td>
		);
	}

	return (
		<td className="p-4 text-right">
			<div className="flex items-center justify-end gap-2">
				<button
					className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-700 text-sm transition hover:bg-slate-50"
					onClick={onRequestEditing}
					type="button"
				>
					Edit
				</button>
				<button
					className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-sm text-white transition hover:bg-slate-800"
					onClick={onRequestDeletion}
					type="button"
				>
					Delete
				</button>
			</div>
		</td>
	);
}
