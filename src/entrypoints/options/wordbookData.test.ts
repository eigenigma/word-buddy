import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
	WordbookEntry,
	WordbookUpdatePatch,
} from "@/shared/wordbook/types";

type WordbookDataModule = typeof import("./wordbookData");
type WordbookStateModule = typeof import("./state");

const {
	requestWordbookListMock,
	requestWordbookRemoveMock,
	requestWordbookUpdateMock,
} = vi.hoisted(() => ({
	requestWordbookListMock: vi.fn(),
	requestWordbookRemoveMock: vi.fn(),
	requestWordbookUpdateMock: vi.fn(),
}));

vi.mock("@/shared/runtime/wordbookClient", () => ({
	requestWordbookList: requestWordbookListMock,
	requestWordbookRemove: requestWordbookRemoveMock,
	requestWordbookUpdate: requestWordbookUpdateMock,
}));

const TEST_ENTRY: WordbookEntry = {
	addedAt: 1,
	context: "agenda context",
	lemma: "agenda",
	original: "agenda",
	sourceUrl: "https://example.com/article",
};

const OTHER_ENTRY: WordbookEntry = {
	addedAt: 2,
	context: "notes context",
	lemma: "notes",
	original: "notes",
	sourceUrl: "https://example.com/notes",
};

let stateModule: WordbookStateModule;
let wordbookData: WordbookDataModule;

beforeEach(async () => {
	requestWordbookListMock.mockReset();
	requestWordbookRemoveMock.mockReset();
	requestWordbookUpdateMock.mockReset();
	stateModule = await import("./state");
	wordbookData = await import("./wordbookData");
	stateModule.wordbookEditError.value = null;
	stateModule.wordbookEntriesState.value = { kind: "loading" };
});

describe("loadWordbookEntries", () => {
	it("clears stale edit errors and loads entries", async () => {
		stateModule.wordbookEditError.value = "stale error";
		requestWordbookListMock.mockResolvedValue({
			entries: [TEST_ENTRY, OTHER_ENTRY],
		});

		await wordbookData.loadWordbookEntries();

		expect(stateModule.wordbookEditError.value).toBeNull();
		expect(stateModule.wordbookEntriesState.value).toEqual({
			entries: [TEST_ENTRY, OTHER_ENTRY],
			kind: "loaded",
		});
	});

	it("stores an error state when loading fails", async () => {
		requestWordbookListMock.mockRejectedValue(
			new Error("wordbook load failed"),
		);

		await wordbookData.loadWordbookEntries();

		expect(stateModule.wordbookEntriesState.value).toEqual({
			kind: "error",
			message: "wordbook load failed",
		});
	});
});

describe("removeWordbookEntry", () => {
	it("stores a response error in the entries state", async () => {
		requestWordbookRemoveMock.mockResolvedValue({
			error: "remove failed",
			removed: false,
		});

		await wordbookData.removeWordbookEntry(TEST_ENTRY.lemma);

		expect(stateModule.wordbookEntriesState.value).toEqual({
			kind: "error",
			message: "remove failed",
		});
	});

	it("reloads the list when nothing was removed", async () => {
		requestWordbookRemoveMock.mockResolvedValue({
			error: null,
			removed: false,
		});
		requestWordbookListMock.mockResolvedValue({ entries: [OTHER_ENTRY] });

		await wordbookData.removeWordbookEntry(TEST_ENTRY.lemma);

		expect(requestWordbookListMock).toHaveBeenCalledTimes(1);
		expect(stateModule.wordbookEntriesState.value).toEqual({
			entries: [OTHER_ENTRY],
			kind: "loaded",
		});
	});

	it("removes the entry from the loaded state when the delete succeeds", async () => {
		stateModule.wordbookEntriesState.value = {
			entries: [TEST_ENTRY, OTHER_ENTRY],
			kind: "loaded",
		};
		requestWordbookRemoveMock.mockResolvedValue({ error: null, removed: true });

		await wordbookData.removeWordbookEntry(TEST_ENTRY.lemma);

		expect(stateModule.wordbookEntriesState.value).toEqual({
			entries: [OTHER_ENTRY],
			kind: "loaded",
		});
	});

	it("stores a thrown remove error in the entries state", async () => {
		requestWordbookRemoveMock.mockRejectedValue(new Error("remove exploded"));

		await wordbookData.removeWordbookEntry(TEST_ENTRY.lemma);

		expect(stateModule.wordbookEntriesState.value).toEqual({
			kind: "error",
			message: "remove exploded",
		});
	});
});

describe("updateWordbookEntry", () => {
	it("stores a response error in wordbookEditError", async () => {
		requestWordbookUpdateMock.mockResolvedValue({
			entry: null,
			error: "update failed",
			updated: false,
		});

		await wordbookData.updateWordbookEntry(TEST_ENTRY.lemma, {
			original: "updated agenda",
		});

		expect(stateModule.wordbookEditError.value).toBe("update failed");
	});

	it("updates the matching entry and clears wordbookEditError", async () => {
		const updatedEntry: WordbookEntry = {
			...TEST_ENTRY,
			context: "fresh context",
			original: "updated agenda",
		};
		stateModule.wordbookEntriesState.value = {
			entries: [TEST_ENTRY, OTHER_ENTRY],
			kind: "loaded",
		};
		stateModule.wordbookEditError.value = "stale error";
		requestWordbookUpdateMock.mockResolvedValue({
			entry: updatedEntry,
			error: null,
			updated: true,
		});

		await wordbookData.updateWordbookEntry(TEST_ENTRY.lemma, {
			context: "fresh context",
			original: "updated agenda",
		});

		expect(stateModule.wordbookEditError.value).toBeNull();
		expect(stateModule.wordbookEntriesState.value).toEqual({
			entries: [updatedEntry, OTHER_ENTRY],
			kind: "loaded",
		});
	});

	it("reloads the list when the update result cannot be applied in place", async () => {
		stateModule.wordbookEntriesState.value = {
			entries: [TEST_ENTRY, OTHER_ENTRY],
			kind: "loaded",
		};
		requestWordbookUpdateMock.mockResolvedValue({
			entry: null,
			error: null,
			updated: false,
		});
		requestWordbookListMock.mockResolvedValue({ entries: [OTHER_ENTRY] });

		await wordbookData.updateWordbookEntry(TEST_ENTRY.lemma, {
			original: "updated agenda",
		});

		expect(requestWordbookListMock).toHaveBeenCalledTimes(1);
		expect(stateModule.wordbookEntriesState.value).toEqual({
			entries: [OTHER_ENTRY],
			kind: "loaded",
		});
	});

	it("stores a thrown update error in wordbookEditError", async () => {
		const patch: WordbookUpdatePatch = { original: "updated agenda" };
		requestWordbookUpdateMock.mockRejectedValue(new Error("update exploded"));

		await wordbookData.updateWordbookEntry(TEST_ENTRY.lemma, patch);

		expect(stateModule.wordbookEditError.value).toBe("update exploded");
	});
});
