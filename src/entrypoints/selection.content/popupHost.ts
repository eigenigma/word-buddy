import { h, render } from "preact";
import type {
	ShadowRootContentScriptUi,
	ShadowRootContentScriptUiOptions,
} from "wxt/utils/content-script-ui/shadow-root";

import type { SelectionSnapshot } from "@/shared/dom/selection";

import {
	computeBubbleCoordinates,
	computePopupCoordinates,
	type PopupCoordinates,
	type ViewportDimensions,
} from "./popupLayout";
import { SelectionPopupRoot } from "./SelectionPopupRoot";
import {
	popupState,
	resetPopupTransientState,
	type SelectionPopupState,
	type SelectionUiState,
} from "./state";

export type PopupUi = ShadowRootContentScriptUi<HTMLElement>;
export type PopupUiOptions = ShadowRootContentScriptUiOptions<HTMLElement>;

const CONTAINER_CLASS = "fixed z-2147483647";

export interface SelectionPopupDependencies {
	readonly createUi: (options: PopupUiOptions) => Promise<PopupUi>;
	readonly onAdd: () => void;
	readonly onOpen: () => void;
}

export interface SelectionPopupHost {
	readonly containsEvent: (event: Event) => boolean;
	readonly hide: () => void;
	readonly showBubble: (selection: SelectionSnapshot) => void;
	readonly showCard: (state: SelectionPopupState, rect: DOMRect) => void;
}

function getViewportDimensions(): ViewportDimensions {
	const viewportWindow = globalThis.window;

	return {
		height: viewportWindow.innerHeight,
		width: viewportWindow.innerWidth,
	};
}

export async function createSelectionPopup({
	createUi,
	onAdd,
	onOpen,
}: SelectionPopupDependencies): Promise<SelectionPopupHost> {
	const hide = (): void => {
		popupState.value = null;
		resetPopupTransientState();
	};
	const ui = await createUi({
		name: "word-buddy-selection",
		onMount: (uiContainer: HTMLElement): HTMLElement => {
			render(
				h(SelectionPopupRoot, {
					onAdd: onAdd,
					onClose: hide,
					onOpen: onOpen,
				}),
				uiContainer,
			);
			return uiContainer;
		},
		onRemove: (uiContainer: HTMLElement | undefined): void => {
			if (uiContainer) {
				render(null, uiContainer);
			}
		},
		position: "inline",
	});
	ui.uiContainer.className = CONTAINER_CLASS;

	const show = (
		state: SelectionUiState,
		coordinates: PopupCoordinates,
	): void => {
		popupState.value = state;
		resetPopupTransientState();
		ui.uiContainer.style.left = `${coordinates.left}px`;
		ui.uiContainer.style.top = `${coordinates.top}px`;
		// Mounting also reattaches a host the page has removed; Preact then
		// diffs into the existing container instead of starting over.
		if (!ui.shadowHost.isConnected) {
			ui.mount();
		}
	};

	return {
		// A hidden popup renders nothing, so no event can start inside it.
		containsEvent: (event: Event): boolean =>
			popupState.value !== null && event.composedPath().includes(ui.shadowHost),
		hide: hide,
		showBubble: (selection: SelectionSnapshot): void => {
			show(
				{
					kind: "bubble",
					selection: selection,
				},
				computeBubbleCoordinates(selection.rect, getViewportDimensions()),
			);
		},
		showCard: (state: SelectionPopupState, rect: DOMRect): void => {
			show(
				{
					kind: "card",
					popup: state,
				},
				computePopupCoordinates(rect, getViewportDimensions()),
			);
		},
	};
}
