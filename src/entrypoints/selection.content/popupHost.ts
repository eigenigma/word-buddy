import { effect } from "@preact/signals";
import { h, render } from "preact";
import type {
	ShadowRootContentScriptUi,
	ShadowRootContentScriptUiOptions,
} from "wxt/utils/content-script-ui/shadow-root";

import {
	computeBubbleCoordinates,
	computePopupCoordinates,
	type PopupCoordinates,
	type ViewportDimensions,
} from "./popupLayout";
import {
	SelectionPopupRoot,
	type SelectionPopupRootProps,
} from "./SelectionPopupRoot";
import type { SelectionUiState } from "./state";

export type PopupUi = ShadowRootContentScriptUi<HTMLElement>;
export type PopupUiOptions = ShadowRootContentScriptUiOptions<HTMLElement>;

// The shadow tree has no <html> of its own and WXT resets :host to initial
// values, so the container also takes the root font and line height the
// preflight gives <html>.
const CONTAINER_CLASS = "fixed z-2147483647 font-sans leading-normal";

export interface SelectionPopupDependencies extends SelectionPopupRootProps {
	readonly createUi: (options: PopupUiOptions) => Promise<PopupUi>;
}

export interface SelectionPopupHost {
	readonly containsEvent: (event: Event) => boolean;
}

function getViewportDimensions(): ViewportDimensions {
	const viewportWindow = globalThis.window;

	return {
		height: viewportWindow.innerHeight,
		width: viewportWindow.innerWidth,
	};
}

function computeCoordinates(uiState: SelectionUiState): PopupCoordinates {
	return uiState.kind === "bubble"
		? computeBubbleCoordinates(uiState.selection.rect, getViewportDimensions())
		: computePopupCoordinates(uiState.anchor, getViewportDimensions());
}

export async function createSelectionPopup({
	createUi,
	...rootProps
}: SelectionPopupDependencies): Promise<SelectionPopupHost> {
	let stopPositioning = (): void => undefined;
	const ui = await createUi({
		name: "word-buddy-selection",
		onMount: (uiContainer: HTMLElement): HTMLElement => {
			render(h(SelectionPopupRoot, rootProps), uiContainer);
			return uiContainer;
		},
		onRemove: (uiContainer: HTMLElement | undefined): void => {
			stopPositioning();
			if (uiContainer) {
				render(null, uiContainer);
			}
		},
		position: "inline",
	});
	ui.uiContainer.className = CONTAINER_CLASS;

	stopPositioning = effect((): void => {
		const uiState = rootProps.state.value;
		if (uiState === null) {
			return;
		}

		const coordinates = computeCoordinates(uiState);
		ui.uiContainer.style.left = `${coordinates.left}px`;
		ui.uiContainer.style.top = `${coordinates.top}px`;
		// Mounting also reattaches a host the page has removed; Preact then
		// diffs into the existing container instead of starting over.
		if (!ui.shadowHost.isConnected) {
			ui.mount();
		}
	});

	return {
		// A hidden popup renders nothing, so no event can start inside it.
		containsEvent: (event: Event): boolean =>
			rootProps.state.peek() !== null &&
			event.composedPath().includes(ui.shadowHost),
	};
}
