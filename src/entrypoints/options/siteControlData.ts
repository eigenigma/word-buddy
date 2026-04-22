import { signal } from "@preact/signals";

import {
	requestSiteControlList,
	requestSiteControlSet,
} from "@/shared/runtime/siteControlClient";
import type { SiteControlState } from "@/shared/siteControl/types";
import { runAsyncState } from "@/shared/state/asyncState";
import { toErrorMessage } from "@/shared/utils/errors";

export type SiteControlPanelState =
	| { readonly kind: "loading" }
	| { readonly kind: "ready"; readonly state: SiteControlState }
	| { readonly kind: "error"; readonly message: string };

export const siteControlPanelState = signal<SiteControlPanelState>({
	kind: "loading",
});

export async function loadSiteControl(): Promise<void> {
	await runAsyncState(
		siteControlPanelState,
		{ kind: "loading" },
		async () => await requestSiteControlList(),
		(response): SiteControlPanelState => ({
			kind: "ready",
			state: response.state,
		}),
		(message: string): SiteControlPanelState => ({
			kind: "error",
			message: message,
		}),
	);
}

export async function setHostBlocked(
	host: string,
	blocked: boolean,
): Promise<void> {
	try {
		const response = await requestSiteControlSet(host, blocked);
		siteControlPanelState.value = {
			kind: "ready",
			state: response.state,
		};
	} catch (error: unknown) {
		siteControlPanelState.value = {
			kind: "error",
			message: toErrorMessage(error),
		};
	}
}
