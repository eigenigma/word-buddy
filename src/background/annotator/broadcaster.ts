import {
	ANNOTATOR_INVALIDATE_MESSAGE_TYPE,
	ANNOTATOR_SITE_CONTROL_CHANGED_MESSAGE_TYPE,
} from "@/shared/runtime/messages/annotatorMessages";
import { reportGlobalError } from "@/shared/utils/errors";

export interface TabQuery {
	readonly queryAll: () => Promise<readonly { id: number }[]>;
	readonly sendToTab: (tabId: number, message: unknown) => Promise<void>;
}

export interface AnnotatorBroadcasterDependencies {
	readonly tabs: TabQuery;
}

export interface AnnotatorBroadcaster {
	readonly invalidate: () => Promise<void>;
	readonly siteControlChanged: () => Promise<void>;
}

function reportAnnotatorBroadcastError(error: unknown): void {
	reportGlobalError("word-buddy: annotator broadcast failed", error);
}

async function broadcastMessage(
	dependencies: AnnotatorBroadcasterDependencies,
	type: string,
): Promise<void> {
	const tabs = await dependencies.tabs.queryAll();
	await Promise.allSettled(
		tabs.map((tab) =>
			dependencies.tabs
				.sendToTab(tab.id, { type: type })
				.catch(reportAnnotatorBroadcastError),
		),
	);
}

export function createAnnotatorBroadcaster(
	dependencies: AnnotatorBroadcasterDependencies,
): AnnotatorBroadcaster {
	return {
		invalidate: async (): Promise<void> => {
			await broadcastMessage(dependencies, ANNOTATOR_INVALIDATE_MESSAGE_TYPE);
		},
		siteControlChanged: async (): Promise<void> => {
			await broadcastMessage(
				dependencies,
				ANNOTATOR_SITE_CONTROL_CHANGED_MESSAGE_TYPE,
			);
		},
	};
}
