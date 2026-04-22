import { beforeEach, describe, expect, it } from "vitest";

type OptionsStateModule = typeof import("./state");

let optionsState: OptionsStateModule;

beforeEach(async () => {
	optionsState = await import("./state");
	optionsState.pendingDeletionLemma.value = null;
	optionsState.wordbookEditingLemma.value = null;
	optionsState.wordbookSearchQuery.value = "";
	optionsState.exportError.value = null;
	optionsState.wordbookEditError.value = null;
	optionsState.wordbookEntriesState.value = { kind: "loading" };
});

describe("requestDeletion", () => {
	it("tracks the lemma pending deletion", () => {
		optionsState.requestDeletion("agenda");

		expect(optionsState.pendingDeletionLemma.value).toBe("agenda");
	});
});

describe("requestEditing", () => {
	it("clears a matching pending deletion before editing", () => {
		optionsState.pendingDeletionLemma.value = "agenda";

		optionsState.requestEditing("agenda");

		expect(optionsState.pendingDeletionLemma.value).toBeNull();
		expect(optionsState.wordbookEditingLemma.value).toBe("agenda");
	});

	it("keeps other pending deletions while switching the editing lemma", () => {
		optionsState.pendingDeletionLemma.value = "notes";

		optionsState.requestEditing("agenda");

		expect(optionsState.pendingDeletionLemma.value).toBe("notes");
		expect(optionsState.wordbookEditingLemma.value).toBe("agenda");
	});
});

describe("clearDeletion and clearEditing", () => {
	it("resets both signals independently", () => {
		optionsState.pendingDeletionLemma.value = "agenda";
		optionsState.wordbookEditingLemma.value = "agenda";

		optionsState.clearDeletion();
		optionsState.clearEditing();

		expect(optionsState.pendingDeletionLemma.value).toBeNull();
		expect(optionsState.wordbookEditingLemma.value).toBeNull();
	});
});
