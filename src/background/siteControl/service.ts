import {
	isHostBlocked,
	normalizeHostInput,
	type SiteControlState,
} from "@/shared/siteControl/types";

import type { SiteControlStorage } from "./storage";

export interface SiteControlService {
	readonly isHostBlocked: (host: string) => Promise<boolean>;
	readonly listBlockedHosts: () => Promise<readonly string[]>;
	readonly setHostBlocked: (
		host: string,
		blocked: boolean,
	) => Promise<SiteControlState>;
}

export interface SiteControlServiceDependencies {
	readonly storage: SiteControlStorage;
}

function createSiteControlState(hosts: readonly string[]): SiteControlState {
	return {
		blockedHosts: [...new Set(hosts)].sort(),
	};
}

function requireNormalizedHost(host: string): string {
	const normalizedHost = normalizeHostInput(host);
	if (normalizedHost === null) {
		throw new Error("Invalid host input.");
	}

	return normalizedHost;
}

export function createSiteControlService(
	dependencies: SiteControlServiceDependencies,
): SiteControlService {
	return {
		isHostBlocked: async (host: string): Promise<boolean> =>
			isHostBlocked(await dependencies.storage.readSiteControl(), host),
		listBlockedHosts: async (): Promise<readonly string[]> =>
			(await dependencies.storage.readSiteControl()).blockedHosts,
		setHostBlocked: async (
			host: string,
			blocked: boolean,
		): Promise<SiteControlState> => {
			const normalizedHost = requireNormalizedHost(host);
			const currentState = await dependencies.storage.readSiteControl();
			const nextState = createSiteControlState(
				blocked
					? [...currentState.blockedHosts, normalizedHost]
					: currentState.blockedHosts.filter(
							(currentHost) => currentHost !== normalizedHost,
						),
			);
			await dependencies.storage.writeSiteControl(nextState);
			return nextState;
		},
	};
}
