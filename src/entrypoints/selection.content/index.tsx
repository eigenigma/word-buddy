import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { createShadowRootUi } from "wxt/utils/content-script-ui/shadow-root";

import {
	readActiveSelection,
	readSelectionContext,
	type SelectionSnapshot,
	type ViewportPoint,
} from "@/shared/dom/selection";
import { reportGlobalError } from "@/shared/utils/errors";
import {
	createSelectionPopupController,
	type SelectionPopupController,
} from "./controller";
import type { PopupUi, PopupUiOptions, SelectionPopupHost } from "./popupHost";
import { createSelectionPopup } from "./popupHost";
import {
	addResolvedSelectionToWordbook,
	resolveSelectionPopupState,
} from "./resolveSelection";
import { createTimerScheduler } from "./scheduler";
import type { SelectionPopupState } from "./state";
import "virtual:uno.css";

function registerPageListeners(
	ctx: ContentScriptContext,
	controller: SelectionPopupController,
	popupHost: SelectionPopupHost,
): void {
	ctx.addEventListener(document, "mousedown", (event: MouseEvent): void => {
		if (!popupHost.containsEvent(event)) {
			controller.hide();
		}
	});
	ctx.addEventListener(document, "keydown", (event: KeyboardEvent): void => {
		if (event.key === "Escape") {
			controller.hide();
		}
	});
	ctx.addEventListener(document, "mouseup", (event: MouseEvent): void => {
		if (!popupHost.containsEvent(event)) {
			controller.selectAt({ x: event.clientX, y: event.clientY });
		}
	});
}

export default defineContentScript({
	matches: ["<all_urls>"],
	cssInjectionMode: "ui",
	main: async (ctx: ContentScriptContext): Promise<void> => {
		const controller = createSelectionPopupController({
			addToWordbook: (popup: SelectionPopupState): Promise<void> =>
				addResolvedSelectionToWordbook({
					addedAt: Date.now(),
					popupState: popup,
					sourceUrl: globalThis.location.href,
				}),
			readSelection: (point: ViewportPoint): SelectionSnapshot | null =>
				readActiveSelection(globalThis.window, point),
			reportError: (error: unknown): void => {
				reportGlobalError("word-buddy: selection popup failed", error);
			},
			resolve: (
				selection: SelectionSnapshot,
			): Promise<SelectionPopupState | null> =>
				resolveSelectionPopupState({
					context: readSelectionContext(selection),
					original: selection.text,
				}),
			scheduler: createTimerScheduler(ctx, globalThis.window),
		});
		const popupHost = await createSelectionPopup({
			createUi: (options: PopupUiOptions): Promise<PopupUi> =>
				createShadowRootUi(ctx, options),
			onAdd: controller.add,
			onClose: controller.hide,
			onOpen: controller.open,
			state: controller.state,
		});
		registerPageListeners(ctx, controller, popupHost);
	},
});
