import type { WordbookEntry } from "@/shared/wordbook/types";

function normalizeSearchText(value: string | null): string {
	return (value ?? "").trim().toLowerCase();
}

export function filterWordbookEntries(
	entries: readonly WordbookEntry[],
	query: string,
): readonly WordbookEntry[] {
	const normalizedQuery = normalizeSearchText(query);
	if (normalizedQuery.length === 0) {
		return entries;
	}

	return entries.filter((entry) =>
		[entry.lemma, entry.original, entry.context]
			.filter((value): value is string => value !== null)
			.some((value) => value.toLowerCase().includes(normalizedQuery)),
	);
}
