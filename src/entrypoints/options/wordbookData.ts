import {
	requestWordbookList,
	requestWordbookRemove,
	requestWordbookUpdate,
} from "@/shared/runtime/wordbookClient";
import { runAsyncState } from "@/shared/state/asyncState";
import { toErrorMessage } from "@/shared/utils/errors";
import type { WordbookUpdatePatch } from "@/shared/wordbook/types";

import type { WordbookEntriesState } from "./state";
import { wordbookEditError, wordbookEntriesState } from "./state";

export async function loadWordbookEntries(): Promise<void> {
	wordbookEditError.value = null;
	await runAsyncState(
		wordbookEntriesState,
		{ kind: "loading" },
		async () => await requestWordbookList(),
		(response): WordbookEntriesState => ({
			entries: response.entries,
			kind: "loaded",
		}),
		(message: string): WordbookEntriesState => ({
			kind: "error",
			message: message,
		}),
	);
}

export async function removeWordbookEntry(lemma: string): Promise<void> {
	try {
		const response = await requestWordbookRemove(lemma);
		if (response.error !== null) {
			wordbookEntriesState.value = {
				kind: "error",
				message: response.error,
			};
			return;
		}

		if (!response.removed) {
			await loadWordbookEntries();
			return;
		}

		const currentState = wordbookEntriesState.value;
		if (currentState.kind !== "loaded") {
			await loadWordbookEntries();
			return;
		}

		wordbookEntriesState.value = {
			entries: currentState.entries.filter((entry) => entry.lemma !== lemma),
			kind: "loaded",
		};
	} catch (error: unknown) {
		wordbookEntriesState.value = {
			kind: "error",
			message: toErrorMessage(error),
		};
	}
}

export async function updateWordbookEntry(
	lemma: string,
	patch: WordbookUpdatePatch,
): Promise<void> {
	try {
		const response = await requestWordbookUpdate(lemma, patch);
		if (response.error !== null) {
			wordbookEditError.value = response.error;
			return;
		}

		wordbookEditError.value = null;
		const currentState = wordbookEntriesState.value;
		if (
			currentState.kind !== "loaded" ||
			!response.updated ||
			response.entry === null
		) {
			await loadWordbookEntries();
			return;
		}

		const updatedEntry = response.entry;
		wordbookEntriesState.value = {
			entries: currentState.entries.map((entry) =>
				entry.lemma === lemma ? updatedEntry : entry,
			),
			kind: "loaded",
		};
	} catch (error: unknown) {
		wordbookEditError.value = toErrorMessage(error);
	}
}
