import {
	type AnnotatorBroadcaster,
	createAnnotatorBroadcaster,
} from "@/background/annotator/broadcaster";

const ANNOTATED_TAB_URL_PATTERNS = ["http://*/*", "https://*/*"];

export function createAnnotatorBrowserAdapter(): AnnotatorBroadcaster {
	return createAnnotatorBroadcaster({
		tabs: {
			queryAll: async () =>
				(await browser.tabs.query({ url: ANNOTATED_TAB_URL_PATTERNS }))
					.map((tab) => ({ id: tab.id }))
					.filter((tab): tab is { id: number } => typeof tab.id === "number"),
			sendToTab: (tabId: number, message: unknown) =>
				browser.tabs.sendMessage(tabId, message),
		},
	});
}
