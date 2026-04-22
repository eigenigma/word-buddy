import { useSignal } from "@preact/signals";
import type { JSX } from "preact";

import type { TextInputEvent } from "@/shared/dom/events";
import { isSettingsComplete, type LlmSettings } from "@/shared/settings/types";
import {
	DISABLED_BUTTON_CLASS,
	INPUT_CLASS,
	PANEL_CLASS,
	PRIMARY_BUTTON_CLASS,
	SECONDARY_BUTTON_TALL_MUTED_CLASS,
	STATUS_BANNER_CLASS,
} from "@/shared/ui/styles";
import { toErrorMessage } from "@/shared/utils/errors";

import {
	areSettingsEqual,
	loadSettings,
	type SaveState,
	saveSettings,
	settingsFormState,
	updateSettingField,
} from "../settingsData";
import { TranslationCacheSection } from "./TranslationCacheSection";

interface SettingsFieldsSectionProps {
	readonly apiKeyInputType: "password" | "text";
	readonly draft: LlmSettings;
	readonly onFieldInput: (
		field: keyof LlmSettings,
	) => (event: TextInputEvent) => void;
	readonly onToggleShowKey: () => void;
	readonly showKey: boolean;
}

function reportSettingsLoadError(error: unknown): void {
	settingsFormState.value = {
		kind: "error",
		message: toErrorMessage(error),
	};
}

function reportSettingsSaveError(error: unknown): void {
	const latestState = settingsFormState.value;
	if (latestState.kind !== "ready") {
		settingsFormState.value = {
			kind: "error",
			message: toErrorMessage(error),
		};
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

function SettingsHeader(): JSX.Element {
	return (
		<div>
			<h2 className="font-semibold text-slate-900 text-xl">Settings</h2>
			<p className="mt-1 text-slate-500 text-sm">LLM for inline annotations</p>
		</div>
	);
}

function SettingsField({
	children,
	label,
}: {
	readonly children: JSX.Element;
	readonly label: string;
}): JSX.Element {
	return (
		<div className="grid gap-2">
			<span className="font-medium text-slate-700 text-sm">{label}</span>
			{children}
		</div>
	);
}

function SettingsStatus({
	saveState,
}: {
	readonly saveState: SaveState;
}): JSX.Element | null {
	switch (saveState.kind) {
		case "idle": {
			return null;
		}
		case "saving": {
			return <p className={STATUS_BANNER_CLASS.info}>Saving...</p>;
		}
		case "saved": {
			return <p className={STATUS_BANNER_CLASS.success}>Saved</p>;
		}
		case "error": {
			return <p className={STATUS_BANNER_CLASS.error}>{saveState.message}</p>;
		}
		default: {
			const exhaustiveState: never = saveState;
			throw new Error(`Unknown save state: ${String(exhaustiveState)}`);
		}
	}
}

function SettingsLoadingState(): JSX.Element {
	return (
		<section className={PANEL_CLASS}>
			<div className="flex flex-col gap-4">
				<SettingsHeader />
				<div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
			</div>
		</section>
	);
}

function SettingsErrorState({
	message,
}: {
	readonly message: string;
}): JSX.Element {
	return (
		<section className={PANEL_CLASS}>
			<SettingsHeader />
			<p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-600 text-sm">
				{message}
			</p>
			<button
				className={`mt-4 ${PRIMARY_BUTTON_CLASS}`}
				onClick={(): void => {
					loadSettings().catch(reportSettingsLoadError);
				}}
				type="button"
			>
				Retry
			</button>
		</section>
	);
}

function SettingsFieldsSection({
	apiKeyInputType,
	draft,
	onFieldInput,
	onToggleShowKey,
	showKey,
}: SettingsFieldsSectionProps): JSX.Element {
	return (
		<div className="mt-5 grid gap-4">
			<SettingsField label="Endpoint URL">
				<input
					className={INPUT_CLASS}
					onInput={onFieldInput("endpoint")}
					placeholder="https://api.openai.com/v1/chat/completions"
					type="text"
					value={draft.endpoint}
				/>
			</SettingsField>
			<SettingsField label="API Key">
				<div className="flex gap-3">
					<input
						className={`${INPUT_CLASS} min-w-0 flex-1`}
						onInput={onFieldInput("apiKey")}
						type={apiKeyInputType}
						value={draft.apiKey}
					/>
					<button
						className={SECONDARY_BUTTON_TALL_MUTED_CLASS}
						onClick={onToggleShowKey}
						type="button"
					>
						{showKey ? "Hide" : "Show"}
					</button>
				</div>
			</SettingsField>
			<SettingsField label="Model">
				<input
					className={INPUT_CLASS}
					onInput={onFieldInput("model")}
					placeholder="gpt-4o-mini"
					type="text"
					value={draft.model}
				/>
			</SettingsField>
		</div>
	);
}

function SettingsReadyState({
	draft,
	persisted,
	saveState,
}: {
	readonly draft: LlmSettings;
	readonly persisted: LlmSettings;
	readonly saveState: SaveState;
}): JSX.Element {
	const showKey = useSignal(false);
	const isDirty = !areSettingsEqual(draft, persisted);
	const isSaving = saveState.kind === "saving";
	const apiKeyInputType = showKey.value ? "text" : "password";

	function handleFieldInput(field: keyof LlmSettings) {
		return (event: TextInputEvent): void => {
			updateSettingField(field, event.currentTarget.value);
		};
	}

	return (
		<section className={PANEL_CLASS}>
			<SettingsHeader />
			<SettingsFieldsSection
				apiKeyInputType={apiKeyInputType}
				draft={draft}
				onFieldInput={handleFieldInput}
				onToggleShowKey={(): void => {
					showKey.value = !showKey.value;
				}}
				showKey={showKey.value}
			/>
			<div className="mt-5 flex items-center justify-end">
				<button
					className={
						isSaving || !isDirty ? DISABLED_BUTTON_CLASS : PRIMARY_BUTTON_CLASS
					}
					disabled={isSaving || !isDirty}
					onClick={(): void => {
						saveSettings().catch(reportSettingsSaveError);
					}}
					type="button"
				>
					{isSaving ? "Saving..." : "Save"}
				</button>
			</div>
			<div className="mt-4">
				<SettingsStatus saveState={saveState} />
			</div>
			<TranslationCacheSection />
			{isSettingsComplete(persisted) ? null : (
				<p className={STATUS_BANNER_CLASS.warning}>
					Inline annotations disabled until settings are complete
				</p>
			)}
		</section>
	);
}
export function SettingsPanel(): JSX.Element {
	const formState = settingsFormState.value;

	if (formState.kind === "loading") {
		return <SettingsLoadingState />;
	}
	if (formState.kind === "error") {
		return <SettingsErrorState message={formState.message} />;
	}

	return (
		<SettingsReadyState
			draft={formState.draft}
			persisted={formState.persisted}
			saveState={formState.saveState}
		/>
	);
}
