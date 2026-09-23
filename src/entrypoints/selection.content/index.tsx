import type { ContentScriptContext } from "wxt/utils/content-script-context";

import {
	findEnclosingBlock,
	readActiveSelection,
	type ViewportPoint,
} from "@/shared/dom/selection";
import { extractContainingSentence } from "@/shared/dom/sentence";
import { toError } from "@/shared/utils/errors";
import type { SelectionPopupHost } from "./popupHost";
import { createSelectionPopup } from "./popupHost";
import {
	addResolvedSelectionToWordbook,
	getCurrentPopupState,
	hasActiveCardPopup,
	resolveSelectionPopupState,
} from "./resolveSelection";
import type { SelectionBubbleUiState, SelectionPopupState } from "./state";
import { addError, addInFlight, popupState, resolveInFlight } from "./state";
import "virtual:uno.css";

function getSelectionContext(currentUiState: SelectionBubbleUiState): string {
	const { selection } = currentUiState;
	const contextBlock = findEnclosingBlock(
		selection.range.commonAncestorContainer,
	);
	return extractContainingSentence(
		// biome-ignore lint/nursery/useDomNodeTextContent: lookup context must be rendered text; textContent pulls in hidden and script content and drops line breaks
		contextBlock.innerText,
		selection.text,
	);
}

async function openSelectionPopup(
	popupHost: SelectionPopupHost,
	currentUiState: SelectionBubbleUiState,
): Promise<void> {
	try {
		const state = await resolveSelectionPopupState({
			context: getSelectionContext(currentUiState),
			original: currentUiState.selection.text,
		});

		if (popupState.value !== currentUiState) {
			return;
		}
		if (!state) {
			popupHost.hide();
			return;
		}

		popupHost.showCard(state, currentUiState.selection.rect);
	} catch (error: unknown) {
		if (popupState.value === currentUiState) {
			popupHost.hide();
		}
		throw toError(error);
	} finally {
		if (popupState.value === currentUiState) {
			resolveInFlight.value = false;
		}
	}
}

async function addSelectionToWordbook(
	ctx: ContentScriptContext,
	popupHost: SelectionPopupHost,
	currentPopupState: SelectionPopupState,
): Promise<void> {
	try {
		const result = await addResolvedSelectionToWordbook({
			addedAt: Date.now(),
			popupState: currentPopupState,
			sourceUrl: globalThis.location.href,
		});

		addInFlight.value = false;
		if (!hasActiveCardPopup(popupState.value, currentPopupState.lemma)) {
			return;
		}
		if (result.popupState === null) {
			addError.value = result.error;
			return;
		}

		popupState.value = {
			kind: "card",
			popup: result.popupState,
		};
		ctx.setTimeout((): void => {
			if (hasActiveCardPopup(popupState.value, currentPopupState.lemma)) {
				popupHost.hide();
			}
		}, 150);
	} catch (error: unknown) {
		addInFlight.value = false;
		if (hasActiveCardPopup(popupState.value, currentPopupState.lemma)) {
			addError.value = toError(error).message;
		}
	}
}

function scheduleSelectionBubbleOpen(
	ctx: ContentScriptContext,
	popupHost: SelectionPopupHost,
): void {
	const currentUiState = popupState.value;
	if (currentUiState?.kind !== "bubble" || resolveInFlight.value) {
		return;
	}

	resolveInFlight.value = true;
	ctx.setTimeout(async (): Promise<void> => {
		await openSelectionPopup(popupHost, currentUiState);
	}, 0);
}

function scheduleWordbookAdd(
	ctx: ContentScriptContext,
	popupHost: SelectionPopupHost,
): void {
	const currentPopupState = getCurrentPopupState(popupState.value);
	if (!currentPopupState || addInFlight.value) {
		return;
	}

	addInFlight.value = true;
	addError.value = null;
	ctx.setTimeout(async (): Promise<void> => {
		await addSelectionToWordbook(ctx, popupHost, currentPopupState);
	}, 0);
}

function isEventInsidePopup(
	event: MouseEvent,
	popupHost: SelectionPopupHost,
): boolean {
	const shadowHost = popupHost.shadowHost;
	return shadowHost ? event.composedPath().includes(shadowHost) : false;
}

function registerDismissListeners(
	ctx: ContentScriptContext,
	popupHost: SelectionPopupHost,
): void {
	ctx.addEventListener(document, "mousedown", (event: MouseEvent): void => {
		if (!isEventInsidePopup(event, popupHost)) {
			popupHost.hide();
		}
	});
	ctx.addEventListener(document, "keydown", (event: KeyboardEvent): void => {
		if (event.key === "Escape") {
			popupHost.hide();
		}
	});
}

function handleSelectionMouseup(
	popupHost: SelectionPopupHost,
	fallbackPoint: ViewportPoint,
): void {
	const selection = readActiveSelection(globalThis.window, fallbackPoint);
	if (selection) {
		popupHost.showBubble(selection);
	}
}

function registerSelectionListener(
	ctx: ContentScriptContext,
	popupHost: SelectionPopupHost,
): void {
	ctx.addEventListener(document, "mouseup", (event: MouseEvent): void => {
		if (isEventInsidePopup(event, popupHost)) {
			return;
		}

		const fallbackPoint = { x: event.clientX, y: event.clientY };
		ctx.setTimeout((): void => {
			try {
				handleSelectionMouseup(popupHost, fallbackPoint);
			} catch (error: unknown) {
				popupHost.hide();
				throw toError(error);
			}
		}, 50);
	});
}

export default defineContentScript({
	matches: ["<all_urls>"],
	cssInjectionMode: "ui",
	main: async (ctx: ContentScriptContext): Promise<void> => {
		let popupHost: SelectionPopupHost | null = null;
		const onAdd = (): void => {
			if (popupHost) {
				scheduleWordbookAdd(ctx, popupHost);
			}
		};
		const onOpen = (): void => {
			if (popupHost) {
				scheduleSelectionBubbleOpen(ctx, popupHost);
			}
		};

		popupHost = await createSelectionPopup(ctx, onAdd, onOpen);
		registerDismissListeners(ctx, popupHost);
		registerSelectionListener(ctx, popupHost);
	},
});
