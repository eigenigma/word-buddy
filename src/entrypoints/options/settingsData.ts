import { type Signal, signal } from "@preact/signals";
import { requestTranslationCacheClear } from "@/shared/runtime/llmClient";
import {
	requestSettingsGet,
	requestSettingsSet,
} from "@/shared/runtime/settingsClient";
import type { LlmSettings } from "@/shared/settings/types";
import { runAsyncState } from "@/shared/state/asyncState";
import { toErrorMessage } from "@/shared/utils/errors";

export type SaveState =
	| { readonly kind: "idle" }
	| { readonly kind: "saving" }
	| { readonly kind: "error"; readonly message: string }
	| { readonly kind: "saved" };

export type TranslationCacheClearState =
	| { readonly kind: "idle" }
	| { readonly kind: "clearing" }
	| { readonly clearedCount: number; readonly kind: "cleared" }
	| { readonly kind: "error"; readonly message: string };

export type SettingsFormState =
	| { readonly kind: "loading" }
	| {
			readonly draft: LlmSettings;
			readonly kind: "ready";
			readonly persisted: LlmSettings;
			readonly saveState: SaveState;
	  }
	| { readonly kind: "error"; readonly message: string };

export const settingsFormState: Signal<SettingsFormState> =
	signal<SettingsFormState>({
		kind: "loading",
	});

export const translationCacheClearState: Signal<TranslationCacheClearState> =
	signal<TranslationCacheClearState>({
		kind: "idle",
	});

export function areSettingsEqual(
	left: LlmSettings,
	right: LlmSettings,
): boolean {
	return (
		left.apiKey === right.apiKey &&
		left.endpoint === right.endpoint &&
		left.model === right.model
	);
}

export async function loadSettings(): Promise<void> {
	await runAsyncState(
		settingsFormState,
		{ kind: "loading" },
		async () => await requestSettingsGet(),
		(response): SettingsFormState => ({
			draft: response.settings,
			kind: "ready",
			persisted: response.settings,
			saveState: { kind: "idle" },
		}),
		(message: string): SettingsFormState => ({
			kind: "error",
			message: message,
		}),
	);
}

export function updateSettingField(
	field: keyof LlmSettings,
	value: string,
): void {
	const currentState = settingsFormState.value;
	if (currentState.kind !== "ready") {
		return;
	}

	settingsFormState.value = {
		...currentState,
		draft: {
			...currentState.draft,
			[field]: value,
		},
		saveState:
			currentState.saveState.kind === "saved" ||
			currentState.saveState.kind === "error"
				? { kind: "idle" }
				: currentState.saveState,
	};
}

export async function saveSettings(): Promise<void> {
	const currentState = settingsFormState.value;
	if (currentState.kind !== "ready") {
		return;
	}

	if (areSettingsEqual(currentState.draft, currentState.persisted)) {
		return;
	}

	const draftToSave = currentState.draft;
	settingsFormState.value = {
		...currentState,
		saveState: {
			kind: "saving",
		},
	};

	try {
		const response = await requestSettingsSet(draftToSave);
		const latestState = settingsFormState.value;
		if (latestState.kind !== "ready") {
			return;
		}

		if (areSettingsEqual(latestState.draft, draftToSave)) {
			settingsFormState.value = {
				draft: response.settings,
				kind: "ready",
				persisted: response.settings,
				saveState: {
					kind: "saved",
				},
			};
			return;
		}

		settingsFormState.value = {
			draft: latestState.draft,
			kind: "ready",
			persisted: response.settings,
			saveState: {
				kind: "idle",
			},
		};
	} catch (error: unknown) {
		const latestState = settingsFormState.value;
		if (latestState.kind !== "ready") {
			return;
		}

		settingsFormState.value = {
			...latestState,
			saveState: {
				kind: "error",
				message: toErrorMessage(error),
			},
		};
	}
}

export async function clearTranslationCache(): Promise<void> {
	if (translationCacheClearState.value.kind === "clearing") {
		return;
	}

	translationCacheClearState.value = {
		kind: "clearing",
	};

	try {
		const response = await requestTranslationCacheClear();
		translationCacheClearState.value = {
			clearedCount: response.clearedCount,
			kind: "cleared",
		};
	} catch (error: unknown) {
		translationCacheClearState.value = {
			kind: "error",
			message: toErrorMessage(error),
		};
	}
}
