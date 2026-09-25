import { h, render } from "preact";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

import type { SelectionSnapshot } from "@/shared/dom/selection";

import {
	computeBubbleCoordinates,
	computePopupCoordinates,
	type PopupCoordinates,
	type ViewportDimensions,
} from "./popupLayout";
import { SelectionPopupRoot } from "./SelectionPopupRoot";
import type { SelectionPopupState, SelectionUiState } from "./state";
import { popupState, resetPopupTransientState } from "./state";

export interface SelectionPopupHost {
	readonly hide: () => void;
	readonly shadowHost: HTMLElement | null;
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

function setImportantStyle(
	element: HTMLElement,
	property: string,
	value: string,
): void {
	element.style.setProperty(property, value, "important");
}

function applyImportantStyles(
	element: HTMLElement,
	styles: Readonly<Record<string, string>>,
): void {
	for (const [property, value] of Object.entries(styles)) {
		setImportantStyle(element, property, value);
	}
}

function applyPopupContainerStyles(
	uiContainer: HTMLElement,
	coordinates: PopupCoordinates,
): void {
	applyImportantStyles(uiContainer, {
		left: `${coordinates.left}px`,
		overflow: "visible",
		"pointer-events": "auto",
		position: "fixed",
		top: `${coordinates.top}px`,
		"z-index": "2147483647",
	});
}

function renderPopupRoot(
	onAdd: () => void,
	onClose: () => void,
	onOpen: () => void,
	uiContainer: HTMLElement,
): void {
	render(
		h(SelectionPopupRoot, {
			onAdd: onAdd,
			onClose: onClose,
			onOpen: onOpen,
		}),
		uiContainer,
	);
}

function createHideHandler(ui: { remove: () => void }): () => void {
	return (): void => {
		popupState.value = null;
		resetPopupTransientState();
		ui.remove();
	};
}

function createOnMountHandler(
	getCoordinates: () => PopupCoordinates | null,
	setShadowHost: (shadowHost: HTMLElement) => void,
	onAdd: () => void,
	onClose: () => void,
	onOpen: () => void,
): (
	uiContainer: HTMLElement,
	shadow: ShadowRoot,
	shadowHost: HTMLElement,
) => HTMLElement {
	return (
		uiContainer: HTMLElement,
		_shadow: ShadowRoot,
		shadowHost: HTMLElement,
	): HTMLElement => {
		const currentCoordinates = getCoordinates();

		if (!currentCoordinates) {
			throw new Error("Popup coordinates are missing.");
		}

		setShadowHost(shadowHost);
		applyPopupContainerStyles(uiContainer, currentCoordinates);
		renderPopupRoot(onAdd, onClose, onOpen, uiContainer);

		return uiContainer;
	};
}

function createShowHandler(
	ui: {
		readonly mount: () => void;
		readonly remove: () => void;
	},
	setCoordinates: (coordinates: PopupCoordinates) => void,
): (state: SelectionUiState, coordinates: PopupCoordinates) => void {
	return (state: SelectionUiState, coordinates: PopupCoordinates): void => {
		setCoordinates(coordinates);
		popupState.value = state;
		resetPopupTransientState();
		ui.remove();
		ui.mount();
	};
}

export async function createSelectionPopup(
	ctx: ContentScriptContext,
	onAdd: () => void,
	onOpen: () => void,
): Promise<SelectionPopupHost> {
	let currentCoordinates: PopupCoordinates | null = null;
	let currentShadowHost: HTMLElement | null = null;
	const setCoordinates = (coordinates: PopupCoordinates): void => {
		currentCoordinates = coordinates;
	};
	const setShadowHost = (shadowHost: HTMLElement): void => {
		currentShadowHost = shadowHost;
	};
	const clearShadowHost = (): void => {
		currentShadowHost = null;
	};
	const ui = await createShadowRootUi(ctx, {
		name: "word-buddy-selection",
		position: "inline",
		anchor: "body",
		append: (_anchor: Element, uiElement: Element): void => {
			document.body.append(uiElement);
		},
		onMount: createOnMountHandler(
			(): PopupCoordinates | null => currentCoordinates,
			setShadowHost,
			onAdd,
			(): void => hide(),
			onOpen,
		),
		onRemove: (uiContainer: HTMLElement | undefined): void => {
			clearShadowHost();
			if (uiContainer) {
				render(null, uiContainer);
			}
		},
	});
	const hide = createHideHandler(ui);
	const show = createShowHandler(ui, setCoordinates);

	return {
		hide: hide,
		get shadowHost(): HTMLElement | null {
			return currentShadowHost;
		},
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
