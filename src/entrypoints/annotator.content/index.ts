import type { ContentScriptContext } from "wxt/utils/content-script-context";

import { requestSettingsGet } from "@/shared/runtime/settingsClient";
import { requestSiteControlIsBlocked } from "@/shared/runtime/siteControlClient";
import { isSettingsComplete } from "@/shared/settings/types";

import { buildMatcher, findCandidateBlocks, type MatcherState } from "./core";
import { type AnnotatorLogger, createAnnotatorLogger } from "./logger";
import { registerAnnotatorListener } from "./messageListener";
import { createAnnotatorRuntime, disposeAnnotatorRuntime } from "./runtime";

async function bootAnnotator(
	ctx: ContentScriptContext,
	logger: AnnotatorLogger,
): Promise<void> {
	if (
		document.contentType !== "text/html" ||
		globalThis.location.protocol === "moz-extension:" ||
		globalThis.location.protocol === "chrome-extension:"
	) {
		return;
	}

	const { settings } = await requestSettingsGet();
	if (!isSettingsComplete(settings)) {
		logger.info(
			"word-buddy annotator: skipped because LLM settings are incomplete.",
		);
		return;
	}

	const isCurrentHostBlocked = async (host: string): Promise<boolean> => {
		const response = await requestSiteControlIsBlocked(host);
		return response.blocked;
	};
	const currentHost = globalThis.location.hostname;
	if (await isCurrentHostBlocked(currentHost)) {
		const removeListener = registerAnnotatorListener({
			disposeRuntime: disposeAnnotatorRuntime,
			host: currentHost,
			isCurrentHostBlocked: isCurrentHostBlocked,
			logger: logger,
			runtime: null,
		});
		logger.info("word-buddy annotator: paused on this site.");
		ctx.onInvalidated((): void => {
			removeListener();
		});
		return;
	}

	const state: MatcherState = { matcher: await buildMatcher() };
	const runtime = createAnnotatorRuntime({
		ctx: ctx,
		logger: logger,
		processedBlocks: new WeakSet<HTMLElement>(),
		state: state,
	});
	const removeListener = registerAnnotatorListener({
		disposeRuntime: disposeAnnotatorRuntime,
		host: currentHost,
		isCurrentHostBlocked: isCurrentHostBlocked,
		logger: logger,
		runtime: runtime,
	});

	for (const block of findCandidateBlocks(document)) {
		runtime.observer.observe(block);
	}
	if (document.body) {
		runtime.mutationObserver.start(document.body);
	}
	ctx.onInvalidated((): void => {
		removeListener();
		disposeAnnotatorRuntime(runtime);
	});
}

export default defineContentScript({
	matches: ["<all_urls>"],
	runAt: "document_idle",
	main: async (ctx: ContentScriptContext): Promise<void> => {
		const logger = createAnnotatorLogger();
		try {
			await bootAnnotator(ctx, logger);
		} catch (error: unknown) {
			logger.warn("word-buddy annotator boot failed:", error);
		}
	},
});
