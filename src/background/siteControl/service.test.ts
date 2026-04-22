import { describe, expect, it } from "vitest";

import {
	normalizeHostInput,
	type SiteControlState,
} from "../../shared/siteControl/types";

import { createSiteControlService } from "./service";

interface InMemorySiteControlStorage {
	readonly readSiteControl: () => Promise<SiteControlState>;
	readonly state: { state: SiteControlState };
	readonly writeSiteControl: (state: SiteControlState) => Promise<void>;
}

function createInMemoryStorage(
	initialState: SiteControlState = { blockedHosts: [] },
): InMemorySiteControlStorage {
	const storage = { state: initialState };
	return {
		readSiteControl: async (): Promise<SiteControlState> => storage.state,
		state: storage,
		writeSiteControl: async (state: SiteControlState): Promise<void> => {
			storage.state = state;
		},
	};
}

describe("normalizeHostInput", () => {
	it("rejects blank and non-host text", () => {
		expect(normalizeHostInput("  ")).toBeNull();
		expect(normalizeHostInput("just plain text")).toBeNull();
	});
});

describe("createSiteControlService", () => {
	it("normalizes, deduplicates, sorts, exact-matches, and removes blocked hosts", async () => {
		const storage = createInMemoryStorage();
		const service = createSiteControlService({ storage: storage });

		let state = await service.setHostBlocked("https://example.com/path", true);
		expect(state.blockedHosts).toEqual(["example.com"]);

		state = await service.setHostBlocked("WWW.Example.Com", true);
		expect(state.blockedHosts).toEqual(["example.com"]);
		await expect(service.isHostBlocked("docs.example.com")).resolves.toBe(
			false,
		);

		state = await service.setHostBlocked("zeta.example.com", true);
		state = await service.setHostBlocked("alpha.example.com", true);
		expect(state.blockedHosts).toEqual([
			"alpha.example.com",
			"example.com",
			"zeta.example.com",
		]);

		state = await service.setHostBlocked("example.com", false);
		expect(state.blockedHosts).toEqual([
			"alpha.example.com",
			"zeta.example.com",
		]);
		await expect(service.listBlockedHosts()).resolves.toEqual([
			"alpha.example.com",
			"zeta.example.com",
		]);
		expect(storage.state.state.blockedHosts).toEqual([
			"alpha.example.com",
			"zeta.example.com",
		]);
	});
});
