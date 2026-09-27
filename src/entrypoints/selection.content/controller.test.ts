// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import type { SelectionSnapshot } from "@/shared/dom/selection";
import { sleep } from "@/shared/utils/async";
import {
	createFakeContext,
	createManualTimers,
	type FakeContext,
	type ManualTimers,
} from "@/test-helpers/schedulerFakes";
import {
	createSelectionPopupController,
	type SelectionPopupController,
} from "./controller";
import { createTimerScheduler } from "./scheduler";
import type { SelectionPopupState } from "./state";

interface Harness {
	readonly adds: PromiseWithResolvers<void>[];
	readonly controller: SelectionPopupController;
	readonly errors: unknown[];
	readonly fake: FakeContext;
	readonly manual: ManualTimers;
	readonly page: { readSelection: () => SelectionSnapshot | null };
	readonly resolves: PromiseWithResolvers<SelectionPopupState | null>[];
}

const POPUP: SelectionPopupState = {
	alreadyAdded: false,
	context: "They went home.",
	entry: null,
	lemma: "go",
	original: "went",
};

function createSelection(): SelectionSnapshot {
	return {
		range: document.createRange(),
		rect: new DOMRect(100, 200, 40, 16),
		text: "went",
	};
}

function createHarness(): Harness {
	const fake = createFakeContext();
	const manual = createManualTimers();
	const adds: Harness["adds"] = [];
	const resolves: Harness["resolves"] = [];
	const errors: unknown[] = [];
	const page: Harness["page"] = { readSelection: createSelection };
	const controller = createSelectionPopupController({
		addToWordbook: (): Promise<void> => {
			const add = Promise.withResolvers<void>();
			adds.push(add);
			return add.promise;
		},
		readSelection: (): SelectionSnapshot | null => page.readSelection(),
		reportError: (error: unknown): void => {
			errors.push(error);
		},
		resolve: (): Promise<SelectionPopupState | null> => {
			const resolve = Promise.withResolvers<SelectionPopupState | null>();
			resolves.push(resolve);
			return resolve.promise;
		},
		scheduler: createTimerScheduler(fake.context, manual.timers),
	});

	return {
		adds: adds,
		controller: controller,
		errors: errors,
		fake: fake,
		manual: manual,
		page: page,
		resolves: resolves,
	};
}

function select({ controller, manual }: Harness): void {
	controller.selectAt({ x: 120, y: 208 });
	manual.runAll();
}

function startOpen(harness: Harness): void {
	select(harness);
	harness.controller.open();
	harness.manual.runAll();
}

async function openCard(harness: Harness): Promise<void> {
	startOpen(harness);
	harness.resolves.at(-1)?.resolve(POPUP);
	await sleep(0);
}

function startAdd({ controller, manual }: Harness): void {
	controller.add();
	manual.runAll();
}

describe("createSelectionPopupController selection", () => {
	it("shows the bubble for the selection read after mouseup", () => {
		const harness = createHarness();

		harness.controller.selectAt({ x: 120, y: 208 });
		const beforeRead = harness.controller.state.value;
		harness.manual.runAll();

		expect(beforeRead).toBeNull();
		expect(harness.manual.pendingDelays()).toStrictEqual([]);
		expect(harness.controller.state.value).toMatchObject({
			kind: "bubble",
			resolving: false,
		});
	});

	it("keeps the popup when nothing is selected", async () => {
		const harness = createHarness();
		await openCard(harness);
		const card = harness.controller.state.value;
		harness.page.readSelection = (): null => null;

		select(harness);

		expect(harness.controller.state.value).toBe(card);
	});

	it("hides and reports a failed selection read", async () => {
		const harness = createHarness();
		await openCard(harness);
		harness.page.readSelection = (): never => {
			throw new Error("detached range");
		};

		select(harness);

		expect(harness.controller.state.value).toBeNull();
		expect(harness.errors).toStrictEqual([new Error("detached range")]);
	});

	it("keeps each controller's state to itself", () => {
		const first = createHarness();
		const second = createHarness();

		select(first);

		expect(first.controller.state.value?.kind).toBe("bubble");
		expect(second.controller.state.value).toBeNull();
	});
});

describe("createSelectionPopupController resolve", () => {
	it("opens the card for the resolved selection", async () => {
		const harness = createHarness();

		await openCard(harness);

		expect(harness.controller.state.value).toMatchObject({
			adding: false,
			kind: "card",
			popup: POPUP,
		});
	});

	it("drops a resolve that finishes after the popup is dismissed", async () => {
		const harness = createHarness();
		startOpen(harness);

		harness.controller.hide();
		harness.resolves[0]?.resolve(POPUP);
		await sleep(0);

		expect(harness.controller.state.value).toBeNull();
	});

	it("hides and reports a failed resolve", async () => {
		const harness = createHarness();
		startOpen(harness);

		harness.resolves[0]?.reject(new Error("offline"));
		await sleep(0);

		expect(harness.controller.state.value).toBeNull();
		expect(harness.errors).toStrictEqual([new Error("offline")]);
	});

	it("starts no request once the context is invalidated", async () => {
		const harness = createHarness();
		await openCard(harness);
		select(harness);

		harness.fake.invalidate();
		harness.controller.open();
		harness.manual.runAll();

		expect(harness.resolves).toHaveLength(1);
		expect(harness.manual.pendingDelays()).toStrictEqual([]);
	});
});

describe("createSelectionPopupController add", () => {
	it("marks the word added, then dismisses the card", async () => {
		const harness = createHarness();
		await openCard(harness);
		startAdd(harness);

		harness.adds[0]?.resolve();
		await sleep(0);
		const added = harness.controller.state.value;
		harness.manual.runAll();

		expect(added).toMatchObject({
			adding: false,
			popup: { alreadyAdded: true },
		});
		expect(harness.controller.state.value).toBeNull();
	});

	it("drops an add that finishes after the popup is dismissed", async () => {
		const harness = createHarness();
		await openCard(harness);
		startAdd(harness);

		harness.controller.hide();
		harness.adds[0]?.resolve();
		await sleep(0);

		expect(harness.controller.state.value).toBeNull();
		expect(harness.manual.pendingDelays()).toStrictEqual([]);
	});

	it("ignores the old add once the same lemma reopens", async () => {
		const harness = createHarness();
		await openCard(harness);
		startAdd(harness);
		harness.controller.hide();
		await openCard(harness);
		const reopened = harness.controller.state.value;

		harness.adds[0]?.resolve();
		await sleep(0);

		expect(harness.controller.state.value).toBe(reopened);
		expect(harness.manual.pendingDelays()).toStrictEqual([]);
	});

	it("shows a failed add on the card and lets it retry", async () => {
		const harness = createHarness();
		await openCard(harness);
		startAdd(harness);

		harness.adds[0]?.reject(new Error("quota exceeded"));
		await sleep(0);
		const failed = harness.controller.state.value;
		startAdd(harness);

		expect(failed).toMatchObject({
			addError: "quota exceeded",
			adding: false,
		});
		expect(harness.controller.state.value).toMatchObject({
			addError: null,
			adding: true,
		});
		expect(harness.adds).toHaveLength(2);
	});
});
