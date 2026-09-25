// @vitest-environment jsdom
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
import { popupState, type SelectionPopupState } from "./state";

const HOISTED_STYLE_SELECTOR = "style[wxt-shadow-root-document-styles]";
// splitShadowRootCss hoists @property blocks into the host document, the same
// way it hoists the real UnoCSS registrations.
const HOISTED_CSS =
	"@property --word-buddy-test { syntax: '*'; inherits: false; }";
const SELECTION_RECT = new DOMRect(100, 200, 40, 16);

interface Harness {
	readonly ctx: ContentScriptContext;
	readonly popup: SelectionPopupHost;
	readonly ui: PopupUi;
}

async function createHarness(): Promise<Harness> {
	const ctx = new ContentScriptContext("selection");
	onTestFinished(() => {
		ctx.abort();
	});
	const createdUi = Promise.withResolvers<PopupUi>();
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
		onOpen: vi.fn<() => void>(),
	});
	return { ctx: ctx, popup: popup, ui: await createdUi.promise };
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

function showBubbleAt(popup: SelectionPopupHost, rect: DOMRect): void {
	act(() => {
		popup.showBubble({
			range: document.createRange(),
			rect: rect,
			text: "went",
		});
	});
}

function showCardAt(
	popup: SelectionPopupHost,
	rect: DOMRect,
	alreadyAdded = false,
): void {
	act(() => {
		popup.showCard(createCardState(alreadyAdded), rect);
	});
}

function hide(popup: SelectionPopupHost): void {
	act(() => {
		popup.hide();
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
	popupState.value = null;
	document.body.replaceChildren();
});

describe("createSelectionPopup", () => {
	it("keeps the one hoisted style element across shows and hides", async () => {
		const { popup } = await createHarness();

		showBubbleAt(popup, SELECTION_RECT);
		const hoistedStyle = document.querySelector(HOISTED_STYLE_SELECTOR);
		showCardAt(popup, SELECTION_RECT);
		hide(popup);
		showBubbleAt(popup, new DOMRect(300, 400, 40, 16));

		expect(document.querySelectorAll(HOISTED_STYLE_SELECTOR)).toHaveLength(1);
		expect(document.querySelector(HOISTED_STYLE_SELECTOR)).toBe(hoistedStyle);
	});

	it("moves the popup on every show, bubble to card included", async () => {
		const { popup, ui } = await createHarness();
		const cardRect = new DOMRect(500, 50, 60, 18);

		showBubbleAt(popup, SELECTION_RECT);
		const bubblePosition = readPosition(ui);
		showCardAt(popup, cardRect);
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
		const { popup, ui } = await createHarness();
		const mount = vi.spyOn(ui, "mount");

		showBubbleAt(popup, SELECTION_RECT);
		const bubbleLabel = ui.uiContainer.querySelector("button")?.textContent;
		showCardAt(popup, SELECTION_RECT);

		expect(bubbleLabel).toBe("WB");
		expect(ui.uiContainer.querySelector("h2")?.textContent).toBe("go");
		expect(mount).toHaveBeenCalledTimes(1);
	});

	it("reattaches a host the page removed without rebuilding the tree", async () => {
		const { popup, ui } = await createHarness();
		showCardAt(popup, SELECTION_RECT);
		const renderedRoot = ui.uiContainer.firstElementChild;

		ui.shadowHost.remove();
		showCardAt(popup, SELECTION_RECT, true);

		expect(document.body.contains(ui.shadowHost)).toBe(true);
		expect(ui.uiContainer.firstElementChild).toBe(renderedRoot);
		expect(ui.uiContainer.textContent).toContain("Already in wordbook");
	});

	it("hides by clearing the rendered popup while the host stays mounted", async () => {
		const { popup, ui } = await createHarness();
		showCardAt(popup, SELECTION_RECT);

		hide(popup);

		expect(popupState.value).toBeNull();
		expect(ui.shadowHost.isConnected).toBe(true);
		expect(ui.uiContainer.firstElementChild).toBeNull();
	});

	it("counts only events that start inside the shown popup", async () => {
		const { ctx, popup, ui } = await createHarness();
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

		showCardAt(popup, SELECTION_RECT);
		dispatchMousedown(ui.uiContainer.querySelector("button"));
		dispatchMousedown(document.body);
		hide(popup);
		dispatchMousedown(ui.uiContainer);

		expect(insideResults).toStrictEqual([true, false, false]);
	});

	it("removes the host and the hoisted style once the context is invalidated", async () => {
		const { ctx, popup, ui } = await createHarness();
		showCardAt(popup, SELECTION_RECT);

		ctx.abort();

		expect(ui.shadowHost.isConnected).toBe(false);
		expect(document.querySelector(HOISTED_STYLE_SELECTOR)).toBeNull();
		expect(ui.uiContainer.firstElementChild).toBeNull();
	});
});
