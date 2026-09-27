// @vitest-environment jsdom
import { type Signal, signal } from "@preact/signals";
import { act } from "preact/test-utils";
import { afterEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { ContentScriptContext } from "wxt/utils/content-script-context";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

import {
	createSelectionPopup,
	type PopupUi,
	type PopupUiOptions,
	type SelectionPopupHost,
} from "./popupHost";
import {
	computeBubbleCoordinates,
	computePopupCoordinates,
	type ViewportDimensions,
} from "./popupLayout";
import type { SelectionPopupState, SelectionUiState } from "./state";

const HOISTED_STYLE_SELECTOR = "style[wxt-shadow-root-document-styles]";
// splitShadowRootCss hoists @property blocks into the host document, the same
// way it hoists the real UnoCSS registrations.
const HOISTED_CSS =
	"@property --word-buddy-test { syntax: '*'; inherits: false; }";
const SELECTION_RECT = new DOMRect(100, 200, 40, 16);

interface Harness {
	readonly ctx: ContentScriptContext;
	readonly popup: SelectionPopupHost;
	readonly state: Signal<SelectionUiState | null>;
	readonly ui: PopupUi;
}

async function createHarness(): Promise<Harness> {
	const ctx = new ContentScriptContext("selection");
	onTestFinished(() => {
		ctx.abort();
	});
	const createdUi = Promise.withResolvers<PopupUi>();
	const state = signal<SelectionUiState | null>(null);
	const popup = await createSelectionPopup({
		createUi: async (options: PopupUiOptions): Promise<PopupUi> => {
			const ui = await createShadowRootUi(ctx, {
				...options,
				css: HOISTED_CSS,
			});
			createdUi.resolve(ui);
			return ui;
		},
		onAdd: vi.fn<() => void>(),
		onClose: vi.fn<() => void>(),
		onOpen: vi.fn<() => void>(),
		state: state,
	});
	return { ctx: ctx, popup: popup, state: state, ui: await createdUi.promise };
}

function createCardState(alreadyAdded: boolean): SelectionPopupState {
	return {
		alreadyAdded: alreadyAdded,
		context: "They went home.",
		entry: null,
		lemma: "go",
		original: "went",
	};
}

function showBubbleAt({ state }: Harness, rect: DOMRect): void {
	act(() => {
		state.value = {
			kind: "bubble",
			resolving: false,
			selection: { range: document.createRange(), rect: rect, text: "went" },
		};
	});
}

function showCardAt(
	{ state }: Harness,
	rect: DOMRect,
	alreadyAdded = false,
): void {
	act(() => {
		state.value = {
			addError: null,
			adding: false,
			anchor: rect,
			kind: "card",
			popup: createCardState(alreadyAdded),
		};
	});
}

function hide({ state }: Harness): void {
	act(() => {
		state.value = null;
	});
}

function readPosition(ui: PopupUi): {
	readonly left: string;
	readonly top: string;
} {
	return {
		left: ui.uiContainer.style.left,
		top: ui.uiContainer.style.top,
	};
}

function getViewport(): ViewportDimensions {
	return { height: window.innerHeight, width: window.innerWidth };
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("createSelectionPopup", () => {
	it("keeps the one hoisted style element across shows and hides", async () => {
		const harness = await createHarness();

		showBubbleAt(harness, SELECTION_RECT);
		const hoistedStyle = document.querySelector(HOISTED_STYLE_SELECTOR);
		showCardAt(harness, SELECTION_RECT);
		hide(harness);
		showBubbleAt(harness, new DOMRect(300, 400, 40, 16));

		expect(document.querySelectorAll(HOISTED_STYLE_SELECTOR)).toHaveLength(1);
		expect(document.querySelector(HOISTED_STYLE_SELECTOR)).toBe(hoistedStyle);
	});

	it("moves the popup on every show, bubble to card included", async () => {
		const harness = await createHarness();
		const { ui } = harness;
		const cardRect = new DOMRect(500, 50, 60, 18);

		showBubbleAt(harness, SELECTION_RECT);
		const bubblePosition = readPosition(ui);
		showCardAt(harness, cardRect);
		const cardPosition = readPosition(ui);

		const expectedBubble = computeBubbleCoordinates(
			SELECTION_RECT,
			getViewport(),
		);
		const expectedCard = computePopupCoordinates(cardRect, getViewport());
		expect(bubblePosition).toStrictEqual({
			left: `${expectedBubble.left}px`,
			top: `${expectedBubble.top}px`,
		});
		expect(cardPosition).toStrictEqual({
			left: `${expectedCard.left}px`,
			top: `${expectedCard.top}px`,
		});
		expect(cardPosition).not.toStrictEqual(bubblePosition);
	});

	it("mounts once for the bubble and the card that follows it", async () => {
		const harness = await createHarness();
		const { ui } = harness;
		const mount = vi.spyOn(ui, "mount");

		showBubbleAt(harness, SELECTION_RECT);
		const bubbleLabel = ui.uiContainer.querySelector("button")?.textContent;
		showCardAt(harness, SELECTION_RECT);

		expect(bubbleLabel).toBe("WB");
		expect(ui.uiContainer.querySelector("h2")?.textContent).toBe("go");
		expect(mount).toHaveBeenCalledTimes(1);
	});

	it("reattaches a host the page removed without rebuilding the tree", async () => {
		const harness = await createHarness();
		const { ui } = harness;
		showCardAt(harness, SELECTION_RECT);
		const renderedRoot = ui.uiContainer.firstElementChild;

		ui.shadowHost.remove();
		showCardAt(harness, SELECTION_RECT, true);

		expect(document.body.contains(ui.shadowHost)).toBe(true);
		expect(ui.uiContainer.firstElementChild).toBe(renderedRoot);
		expect(ui.uiContainer.textContent).toContain("Already in wordbook");
	});

	it("hides by clearing the rendered popup while the host stays mounted", async () => {
		const harness = await createHarness();
		const { ui } = harness;
		showCardAt(harness, SELECTION_RECT);

		hide(harness);

		expect(ui.shadowHost.isConnected).toBe(true);
		expect(ui.uiContainer.firstElementChild).toBeNull();
	});

	it("counts only events that start inside the shown popup", async () => {
		const harness = await createHarness();
		const { ctx, popup, ui } = harness;
		const insideResults: boolean[] = [];
		document.addEventListener(
			"mousedown",
			(event: MouseEvent): void => {
				insideResults.push(popup.containsEvent(event));
			},
			{ signal: ctx.signal },
		);
		const dispatchMousedown = (target: EventTarget | null): void => {
			target?.dispatchEvent(
				new MouseEvent("mousedown", { bubbles: true, composed: true }),
			);
		};

		showCardAt(harness, SELECTION_RECT);
		dispatchMousedown(ui.uiContainer.querySelector("button"));
		dispatchMousedown(document.body);
		hide(harness);
		dispatchMousedown(ui.uiContainer);

		expect(insideResults).toStrictEqual([true, false, false]);
	});

	it("removes the host and the hoisted style once the context is invalidated", async () => {
		const harness = await createHarness();
		const { ctx, ui } = harness;
		showCardAt(harness, SELECTION_RECT);

		ctx.abort();

		expect(ui.shadowHost.isConnected).toBe(false);
		expect(document.querySelector(HOISTED_STYLE_SELECTOR)).toBeNull();
		expect(ui.uiContainer.firstElementChild).toBeNull();
	});
});
