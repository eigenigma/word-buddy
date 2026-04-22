import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LlmSettings } from "@/shared/settings/types";

type SettingsDataModule = typeof import("./settingsData");

const {
	requestSettingsGetMock,
	requestSettingsSetMock,
	requestTranslationCacheClearMock,
} = vi.hoisted(() => ({
	requestSettingsGetMock: vi.fn(),
	requestSettingsSetMock: vi.fn(),
	requestTranslationCacheClearMock: vi.fn(),
}));

vi.mock("@/shared/runtime/settingsClient", () => ({
	requestSettingsGet: requestSettingsGetMock,
	requestSettingsSet: requestSettingsSetMock,
}));

vi.mock("@/shared/runtime/llmClient", () => ({
	requestTranslationCacheClear: requestTranslationCacheClearMock,
}));

const PERSISTED_SETTINGS: LlmSettings = {
	apiKey: "sk-test",
	endpoint: "https://example.com/v1/chat/completions",
	model: "gpt-4o-mini",
};

const DIRTY_SETTINGS: LlmSettings = {
	...PERSISTED_SETTINGS,
	model: "gpt-4.1-mini",
};

function createDeferred<TValue>(): {
	readonly promise: Promise<TValue>;
	reject: (error?: unknown) => void;
	resolve: (value: TValue) => void;
} {
	let reject!: (error?: unknown) => void;
	let resolve!: (value: TValue) => void;
	const promise = new Promise<TValue>((resolvePromise, rejectPromise) => {
		reject = rejectPromise;
		resolve = resolvePromise;
	});

	return {
		promise: promise,
		reject: reject,
		resolve: resolve,
	};
}

let settingsData: SettingsDataModule;

beforeEach(async () => {
	requestSettingsGetMock.mockReset();
	requestSettingsSetMock.mockReset();
	requestTranslationCacheClearMock.mockReset();
	settingsData = await import("./settingsData");
	settingsData.settingsFormState.value = { kind: "loading" };
	settingsData.translationCacheClearState.value = { kind: "idle" };
});

describe("areSettingsEqual", () => {
	it("compares every settings field", () => {
		expect(
			settingsData.areSettingsEqual(PERSISTED_SETTINGS, PERSISTED_SETTINGS),
		).toBe(true);
		expect(
			settingsData.areSettingsEqual(PERSISTED_SETTINGS, {
				...PERSISTED_SETTINGS,
				apiKey: "sk-other",
			}),
		).toBe(false);
	});
});

describe("loadSettings", () => {
	it("loads settings into the ready state", async () => {
		requestSettingsGetMock.mockResolvedValue({ settings: PERSISTED_SETTINGS });

		await settingsData.loadSettings();

		expect(settingsData.settingsFormState.value).toEqual({
			draft: PERSISTED_SETTINGS,
			kind: "ready",
			persisted: PERSISTED_SETTINGS,
			saveState: { kind: "idle" },
		});
	});

	it("stores a load error in the signal", async () => {
		requestSettingsGetMock.mockRejectedValue(new Error("settings load failed"));

		await settingsData.loadSettings();

		expect(settingsData.settingsFormState.value).toEqual({
			kind: "error",
			message: "settings load failed",
		});
	});
});

describe("updateSettingField", () => {
	it("updates a draft field and clears terminal save states", () => {
		settingsData.settingsFormState.value = {
			draft: PERSISTED_SETTINGS,
			kind: "ready",
			persisted: PERSISTED_SETTINGS,
			saveState: { kind: "saved" },
		};

		settingsData.updateSettingField("model", "gpt-4.1");

		expect(settingsData.settingsFormState.value).toEqual({
			draft: {
				...PERSISTED_SETTINGS,
				model: "gpt-4.1",
			},
			kind: "ready",
			persisted: PERSISTED_SETTINGS,
			saveState: { kind: "idle" },
		});
	});
});

describe("saveSettings", () => {
	it("marks the save as successful when the draft is unchanged during the request", async () => {
		settingsData.settingsFormState.value = {
			draft: DIRTY_SETTINGS,
			kind: "ready",
			persisted: PERSISTED_SETTINGS,
			saveState: { kind: "idle" },
		};
		requestSettingsSetMock.mockResolvedValue({ settings: DIRTY_SETTINGS });

		await settingsData.saveSettings();

		expect(requestSettingsSetMock).toHaveBeenCalledWith(DIRTY_SETTINGS);
		expect(settingsData.settingsFormState.value).toEqual({
			draft: DIRTY_SETTINGS,
			kind: "ready",
			persisted: DIRTY_SETTINGS,
			saveState: { kind: "saved" },
		});
	});

	it("preserves a newer draft when the user edits during an in-flight save", async () => {
		const deferred = createDeferred<{ readonly settings: LlmSettings }>();
		settingsData.settingsFormState.value = {
			draft: DIRTY_SETTINGS,
			kind: "ready",
			persisted: PERSISTED_SETTINGS,
			saveState: { kind: "idle" },
		};
		requestSettingsSetMock.mockReturnValue(deferred.promise);

		const savePromise = settingsData.saveSettings();
		settingsData.updateSettingField("model", "gpt-4.1-nano");
		deferred.resolve({ settings: DIRTY_SETTINGS });
		await savePromise;

		expect(settingsData.settingsFormState.value).toEqual({
			draft: {
				...DIRTY_SETTINGS,
				model: "gpt-4.1-nano",
			},
			kind: "ready",
			persisted: DIRTY_SETTINGS,
			saveState: { kind: "idle" },
		});
	});

	it("stores a save error when the request rejects", async () => {
		settingsData.settingsFormState.value = {
			draft: DIRTY_SETTINGS,
			kind: "ready",
			persisted: PERSISTED_SETTINGS,
			saveState: { kind: "idle" },
		};
		requestSettingsSetMock.mockRejectedValue(new Error("settings save failed"));

		await settingsData.saveSettings();

		expect(settingsData.settingsFormState.value).toEqual({
			draft: DIRTY_SETTINGS,
			kind: "ready",
			persisted: PERSISTED_SETTINGS,
			saveState: {
				kind: "error",
				message: "settings save failed",
			},
		});
	});
});

describe("clearTranslationCache", () => {
	it("records the cleared count after a successful clear", async () => {
		requestTranslationCacheClearMock.mockResolvedValue({ clearedCount: 3 });

		await settingsData.clearTranslationCache();

		expect(settingsData.translationCacheClearState.value).toEqual({
			clearedCount: 3,
			kind: "cleared",
		});
	});

	it("does nothing when the cache is already clearing", async () => {
		settingsData.translationCacheClearState.value = { kind: "clearing" };

		await settingsData.clearTranslationCache();

		expect(requestTranslationCacheClearMock).not.toHaveBeenCalled();
		expect(settingsData.translationCacheClearState.value).toEqual({
			kind: "clearing",
		});
	});

	it("stores an error when clearing fails", async () => {
		requestTranslationCacheClearMock.mockRejectedValue(
			new Error("cache clear failed"),
		);

		await settingsData.clearTranslationCache();

		expect(settingsData.translationCacheClearState.value).toEqual({
			kind: "error",
			message: "cache clear failed",
		});
	});
});
