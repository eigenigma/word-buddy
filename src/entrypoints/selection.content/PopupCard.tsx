import type { JSX } from "preact";

import type { DictionaryLookupResult } from "@/shared/runtime/messages/dictionaryMessages";

const EMPTY_STATE_LABEL =
	"No dictionary entry found. You can still add this word to your wordbook.";
const EXISTING_WORD_LABEL = "Already in wordbook";

interface PopupCardProps {
	readonly addError: string | null;
	readonly alreadyAdded: boolean;
	readonly entry: DictionaryLookupResult | null;
	readonly lemma: string;
	readonly onAdd: () => void;
	readonly onClose: () => void;
	readonly original: string;
}

function renderFrequencyBadge(
	entry: DictionaryLookupResult | null,
): JSX.Element | null {
	const bncRank = entry?.frequency.bnc;

	if (bncRank === null || bncRank === undefined) {
		return null;
	}

	return (
		<span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-[11px] text-slate-600">
			BNC #{bncRank}
		</span>
	);
}

function formatTranslation(translation: string | null): string {
	return (translation ?? "").replaceAll("\\n", "\n");
}

function renderEntryBody(entry: DictionaryLookupResult | null): JSX.Element {
	if (!entry) {
		return <p className="mt-3 text-slate-500 text-sm">{EMPTY_STATE_LABEL}</p>;
	}

	return (
		<p className="mt-3 whitespace-pre-line text-slate-700 text-sm leading-6">
			{formatTranslation(entry.translation)}
		</p>
	);
}

function renderAction(
	alreadyAdded: boolean,
	entry: DictionaryLookupResult | null,
	onAdd: () => void,
): JSX.Element | null {
	if (alreadyAdded) {
		return (
			<span className="rounded-full bg-emerald-50 px-3 py-1 font-medium text-[12px] text-emerald-600">
				{EXISTING_WORD_LABEL}
			</span>
		);
	}

	return (
		<button
			className="rounded-lg bg-slate-900 px-3 py-2 font-medium text-sm text-white transition hover:bg-slate-800"
			onClick={onAdd}
			type="button"
		>
			{entry ? "Add to wordbook" : "Add to wordbook anyway"}
		</button>
	);
}

export function PopupCard({
	addError,
	alreadyAdded,
	entry,
	lemma,
	onAdd,
	onClose,
	original,
}: PopupCardProps): JSX.Element {
	const showOriginal = original !== lemma;

	return (
		<div
			className="rounded-xl border border-slate-200 bg-white px-4 py-3 font-sans text-slate-800 shadow-xl"
			style={{
				width: "20rem",
				maxWidth: "calc(100vw - 1rem)",
			}}
		>
			<div className="flex items-start justify-between gap-3">
				<div className="min-w-0 flex-1">
					<div className="flex items-center gap-2">
						<h2 className="truncate font-semibold text-base text-slate-900">
							{lemma}
						</h2>
						{renderFrequencyBadge(entry)}
					</div>
					{showOriginal ? (
						<p className="mt-0.5 text-[11px] text-slate-500">{original}</p>
					) : null}
					{entry?.phonetic ? (
						<p className="mt-1 text-[12px] text-slate-500">
							/{entry.phonetic}/
						</p>
					) : null}
				</div>
				<button
					className="rounded-md px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
					onClick={onClose}
					type="button"
				>
					x
				</button>
			</div>

			{renderEntryBody(entry)}

			{addError ? (
				<p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-[12px] text-rose-600">
					{addError}
				</p>
			) : null}

			<div className="mt-4 flex items-center justify-end">
				{renderAction(alreadyAdded, entry, onAdd)}
			</div>
		</div>
	);
}
