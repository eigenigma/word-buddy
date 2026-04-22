import {
	EMPTY_SITE_CONTROL_STATE,
	type SiteControlState,
	SiteControlStateSchema,
} from "@/shared/siteControl/types";
import { reportGlobalError } from "@/shared/utils/errors";

const SITE_CONTROL_STORAGE_KEY = "wordBuddy.siteControl";

export interface SiteControlStorage {
	readonly readSiteControl: () => Promise<SiteControlState>;
	readonly writeSiteControl: (state: SiteControlState) => Promise<void>;
}

function warnInvalidSiteControl(value: unknown): void {
	reportGlobalError(
		"Invalid site control state in storage",
		new Error(JSON.stringify(value)),
	);
}

export function createBrowserStorageSiteControl(): SiteControlStorage {
	return {
		readSiteControl: async (): Promise<SiteControlState> => {
			const storedValues = await browser.storage.local.get({
				[SITE_CONTROL_STORAGE_KEY]: EMPTY_SITE_CONTROL_STATE,
			});
			const state = storedValues[SITE_CONTROL_STORAGE_KEY];
			const parsedState = SiteControlStateSchema.safeParse(state);
			if (!parsedState.success) {
				warnInvalidSiteControl(state);
				return EMPTY_SITE_CONTROL_STATE;
			}

			return {
				blockedHosts: [...parsedState.data.blockedHosts],
			};
		},
		writeSiteControl: async (state: SiteControlState): Promise<void> => {
			const parsedState = SiteControlStateSchema.safeParse(state);
			if (!parsedState.success) {
				throw new Error(
					`Invalid site control state for storage write: ${parsedState.error.message}`,
				);
			}

			await browser.storage.local.set({
				[SITE_CONTROL_STORAGE_KEY]: parsedState.data,
			});
		},
	};
}
