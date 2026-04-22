import { signal } from "@preact/signals";

import type { WordbookEntry } from "@/shared/wordbook/types";

export type WordbookEntriesState =
	| {
			readonly kind: "loading";
	  }
	| {
			readonly entries: readonly WordbookEntry[];
			readonly kind: "loaded";
	  }
	| {
			readonly kind: "error";
			readonly message: string;
	  };

export const wordbookEntriesState = signal<WordbookEntriesState>({
	kind: "loading",
});

export const pendingDeletionLemma = signal<string | null>(null);
export const wordbookEditingLemma = signal<string | null>(null);
export const wordbookSearchQuery = signal("");
export const exportError = signal<string | null>(null);
export const wordbookEditError = signal<string | null>(null);

export function requestDeletion(lemma: string): void {
	pendingDeletionLemma.value = lemma;
}

export function requestEditing(lemma: string): void {
	if (pendingDeletionLemma.value === lemma) {
		clearDeletion();
	}

	wordbookEditingLemma.value = lemma;
}

export function clearDeletion(): void {
	pendingDeletionLemma.value = null;
}

export function clearEditing(): void {
	wordbookEditingLemma.value = null;
}
