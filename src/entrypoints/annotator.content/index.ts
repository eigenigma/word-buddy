import type { ContentScriptContext } from "wxt/utils/content-script-context";

import { requestSettingsGet } from "@/shared/runtime/settingsClient";
import { requestSiteControlIsBlocked } from "@/shared/runtime/siteControlClient";
import { isSettingsComplete } from "@/shared/settings/types";

import { type AnnotatorLogger, createAnnotatorLogger } from "./logger";
import { registerAnnotatorListener } from "./messageListener";
import { buildMatcher, requestBlockTranslations } from "./requests";
import { createAnnotatorRuntime, type VisibilityCallback } from "./runtime";
import { isDocumentEditable } from "./skipPredicate";

function isAnnotatableDocument(): boolean {
	return (
		document.contentType === "text/html" &&
		globalThis.location.protocol !== "moz-extension:" &&
		globalThis.location.protocol !== "chrome-extension:" &&
		!isDocumentEditable(document)
	);
}

async function isHostBlocked(host: string): Promise<boolean> {
	const response = await requestSiteControlIsBlocked(host);
	return response.blocked;
}

async function bootAnnotator(
	ctx: ContentScriptContext,
	logger: AnnotatorLogger,
): Promise<void> {
	if (!isAnnotatableDocument()) {
		return;
	}

	const host = globalThis.location.hostname;
	const [{ settings }, blocked] = await Promise.all([
		requestSettingsGet(),
		isHostBlocked(host),
	]);
	// onInvalidated never fires for a context that is already invalid, so one
	// lost during the requests above would leave the runtime running.
	if (!isSettingsComplete(settings) || blocked || ctx.isInvalid) {
		return;
	}

	const runtime = createAnnotatorRuntime({
		buildMatcher: buildMatcher,
		createMutationObserver: (callback: MutationCallback): MutationObserver =>
			new MutationObserver(callback),
		createVisibilityObserver: (
			callback: VisibilityCallback,
		): IntersectionObserver => new IntersectionObserver(callback),
		ctx: ctx,
		documentRef: document,
		logger: logger,
		timers: globalThis.window,
		translate: requestBlockTranslations,
	});
	const removeListener = registerAnnotatorListener({
		isSiteBlocked: (): Promise<boolean> => isHostBlocked(host),
		logger: logger,
		runtime: runtime,
	});
	ctx.onInvalidated((): void => {
		removeListener();
		runtime.dispose();
	});
	await runtime.start();
}

export default defineContentScript({
	matches: ["<all_urls>"],
	runAt: "document_idle",
	main: async (ctx: ContentScriptContext): Promise<void> => {
		const logger = createAnnotatorLogger();
		try {
			await bootAnnotator(ctx, logger);
		} catch (error: unknown) {
			logger.warn("boot failed:", error);
		}
	},
});
