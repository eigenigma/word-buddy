import { signal } from "@preact/signals";

import {
	requestSiteControlIsBlocked,
	requestSiteControlSet,
} from "@/shared/runtime/siteControlClient";
import { normalizeHostInput } from "@/shared/siteControl/types";
import { runAsyncState } from "@/shared/state/asyncState";
import { toErrorMessage } from "@/shared/utils/errors";

export type PopupState =
	| { readonly kind: "loading" }
	| {
			readonly blocked: boolean;
			readonly host: string | null;
			readonly kind: "ready";
	  }
	| { readonly kind: "error"; readonly message: string };

export const popupState = signal<PopupState>({ kind: "loading" });

function getHostFromTabUrl(url: string | undefined): string | null {
	if (!url) {
		return null;
	}

	try {
		return normalizeHostInput(new URL(url).hostname);
	} catch {
		return null;
	}
}

export async function loadPopup(): Promise<void> {
	await runAsyncState(
		popupState,
		{ kind: "loading" },
		async (): Promise<PopupState> => {
			const [activeTab] = await browser.tabs.query({
				active: true,
				currentWindow: true,
			});
			const host = getHostFromTabUrl(activeTab?.url);
			if (host === null) {
				return {
					blocked: false,
					host: null,
					kind: "ready",
				};
			}

			const response = await requestSiteControlIsBlocked(host);
			return {
				blocked: response.blocked,
				host: host,
				kind: "ready",
			};
		},
		(state): PopupState => state,
		(message: string): PopupState => ({
			kind: "error",
			message: message,
		}),
	);
}

export async function togglePopup(): Promise<void> {
	const currentState = popupState.value;
	if (currentState.kind !== "ready" || currentState.host === null) {
		return;
	}

	try {
		const response = await requestSiteControlSet(
			currentState.host,
			!currentState.blocked,
		);
		popupState.value = {
			blocked: response.state.blockedHosts.includes(currentState.host),
			host: currentState.host,
			kind: "ready",
		};
	} catch (error: unknown) {
		popupState.value = {
			kind: "error",
			message: toErrorMessage(error),
		};
	}
}
