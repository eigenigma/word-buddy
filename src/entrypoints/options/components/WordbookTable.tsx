import type { JSX } from "preact";

import type { WordbookEntry } from "@/shared/wordbook/types";

import { wordbookSearchQuery } from "../state";
import { filterWordbookEntries } from "../wordbookSearch";
import { EmptyState } from "./EmptyState";
import { WordbookRow } from "./WordbookRow";

interface WordbookTableProps {
	readonly entries: readonly WordbookEntry[];
}

function NoMatchesState(): JSX.Element {
	return (
		<div className="rounded-2xl border border-slate-200 border-dashed bg-white px-6 py-14 text-center shadow-sm">
			<h2 className="font-semibold text-slate-900 text-xl">No matches</h2>
			<p className="mt-3 text-slate-600 text-sm leading-6">
				Try a different lemma, original form, or context substring.
			</p>
		</div>
	);
}

export function WordbookTable({ entries }: WordbookTableProps): JSX.Element {
	const filteredEntries = filterWordbookEntries(
		entries,
		wordbookSearchQuery.value,
	);
	if (entries.length === 0) {
		return <EmptyState />;
	}

	if (filteredEntries.length === 0) {
		return <NoMatchesState />;
	}

	return (
		<div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<div className="overflow-x-auto">
				<table className="min-w-full divide-y divide-slate-200">
					<thead className="bg-slate-50">
						<tr>
							<th className="px-4 py-3 text-left font-medium text-slate-500 text-xs uppercase tracking-wide">
								Lemma
							</th>
							<th className="px-4 py-3 text-left font-medium text-slate-500 text-xs uppercase tracking-wide">
								Added
							</th>
							<th className="px-4 py-3 text-left font-medium text-slate-500 text-xs uppercase tracking-wide">
								Source
							</th>
							<th className="px-4 py-3 text-left font-medium text-slate-500 text-xs uppercase tracking-wide">
								Context
							</th>
							<th className="px-4 py-3 text-right font-medium text-slate-500 text-xs uppercase tracking-wide">
								Action
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-slate-100">
						{filteredEntries.map((entry) => (
							<WordbookRow entry={entry} key={entry.lemma} />
						))}
					</tbody>
				</table>
			</div>
		</div>
	);
}
