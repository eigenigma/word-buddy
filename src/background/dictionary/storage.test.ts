import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SEED_FORMAT_VERSION } from "./assets";
import { createBrowserDictionarySeedStateStorage } from "./storage";

const STORAGE_KEY = "staticDictionarySeedState";

let storedValues: Record<string, unknown> = {};

beforeEach(() => {
	storedValues = {};
	vi.stubGlobal("browser", {
		storage: {
			local: {
				get: async (key: string): Promise<Record<string, unknown>> =>
					key in storedValues ? { [key]: storedValues[key] } : {},
				remove: async (key: string): Promise<void> => {
					storedValues = Object.fromEntries(
						Object.entries(storedValues).filter(
							([storedKey]) => storedKey !== key,
						),
					);
				},
				set: async (values: Record<string, unknown>): Promise<void> => {
					storedValues = { ...storedValues, ...values };
				},
			},
		},
	});
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("createBrowserDictionarySeedStateStorage", () => {
	it("reads back the state it wrote and nothing after clearing", async () => {
		const storage = createBrowserDictionarySeedStateStorage();
		const seedState = {
			assetFingerprint: "asset-fingerprint",
			seedFormatVersion: SEED_FORMAT_VERSION,
		};

		await storage.writeState(seedState);
		await expect(storage.readState()).resolves.toEqual(seedState);

		await storage.clearState();
		await expect(storage.readState()).resolves.toBeNull();
	});

	it("reads a stored state without seedFormatVersion as absent", async () => {
		storedValues = {
			[STORAGE_KEY]: {
				assetFingerprint: "asset-fingerprint",
				assetSchemaVersion: 1,
				dbSchemaVersion: 2,
				dictEntryCount: 1,
				lemmaEntryCount: 1,
			},
		};

		await expect(
			createBrowserDictionarySeedStateStorage().readState(),
		).resolves.toBeNull();
	});
});
