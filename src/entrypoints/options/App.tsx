import type { JSX } from "preact";
import { useCallback, useEffect } from "preact/hooks";

import type { TextInputEvent } from "@/shared/dom/events";
import {
	DISABLED_BUTTON_CLASS,
	INPUT_CLASS,
	PRIMARY_BUTTON_CLASS,
	STATUS_BANNER_CLASS,
} from "@/shared/ui/styles";
import { toErrorMessage } from "@/shared/utils/errors";

import { LoadingState } from "./components/LoadingState";
import { SettingsPanel } from "./components/SettingsPanel";
import { SiteControlPanel } from "./components/SiteControlPanel";
import { WordbookTable } from "./components/WordbookTable";
import { buildLemmaCsv, downloadCsvBlob } from "./csvExport";
import { loadSettings, settingsFormState } from "./settingsData";
import { loadSiteControl, siteControlPanelState } from "./siteControlData";
import {
	clearDeletion,
	clearEditing,
	exportError,
	type WordbookEntriesState,
	wordbookEditError,
	wordbookEntriesState,
	wordbookSearchQuery,
} from "./state";
import { loadWordbookEntries } from "./wordbookData";
import { filterWordbookEntries } from "./wordbookSearch";

interface BannerProps {
	readonly className: string;
	readonly message: string;
}

interface ErrorStateProps {
	readonly message: string;
	readonly onRetry: () => void;
}

interface HeaderBarProps {
	readonly canExport: boolean;
	readonly entryCountLabel: string | null;
	readonly onExport: () => void;
}

type LoadAction = () => Promise<void>;
type SetLoadError = (message: string) => void;

function useLoadOnMount(
	loadAction: LoadAction,
	setLoadError: SetLoadError,
): () => void {
	const reload = useCallback((): void => {
		loadAction().catch((error: unknown): void => {
			setLoadError(toErrorMessage(error));
		});
	}, [loadAction, setLoadError]);

	useEffect(() => {
		reload();
	}, [reload]);

	return reload;
}

function setWordbookLoadError(message: string): void {
	wordbookEntriesState.value = {
		kind: "error",
		message: message,
	};
}

function setSettingsLoadError(message: string): void {
	settingsFormState.value = {
		kind: "error",
		message: message,
	};
}

function setSiteControlLoadError(message: string): void {
	siteControlPanelState.value = {
		kind: "error",
		message: message,
	};
}

function HeaderBar({
	canExport,
	entryCountLabel,
	onExport,
}: HeaderBarProps): JSX.Element {
	const exportButtonClassName = canExport
		? PRIMARY_BUTTON_CLASS
		: DISABLED_BUTTON_CLASS;

	return (
		<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex flex-wrap items-center gap-3">
				<h1 className="font-semibold text-3xl text-slate-900">Word Buddy</h1>
				{entryCountLabel === null ? null : (
					<span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 text-sm">
						{entryCountLabel}
					</span>
				)}
			</div>
			<button
				className={exportButtonClassName}
				disabled={!canExport}
				onClick={onExport}
				type="button"
			>
				Export CSV
			</button>
		</header>
	);
}

function Banner({ className, message }: BannerProps): JSX.Element {
	return <p className={className}>{message}</p>;
}

function ErrorState({ message, onRetry }: ErrorStateProps): JSX.Element {
	return (
		<div className="rounded-2xl border border-rose-200 bg-white px-6 py-10 shadow-sm">
			<h2 className="font-semibold text-lg text-rose-700">
				Failed to load wordbook
			</h2>
			<p className="mt-3 break-words text-rose-600 text-sm leading-6">
				{message}
			</p>
			<button
				className="mt-5 rounded-lg bg-slate-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-slate-800"
				onClick={onRetry}
				type="button"
			>
				Retry
			</button>
		</div>
	);
}

function WordbookToolbar({ query }: { readonly query: string }): JSX.Element {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
			<label className="grid gap-2">
				<span className="font-medium text-slate-700 text-sm">
					Search wordbook
				</span>
				<input
					className={INPUT_CLASS}
					onInput={(event: TextInputEvent): void => {
						wordbookSearchQuery.value = event.currentTarget.value;
					}}
					placeholder="lemma, original, or context"
					type="text"
					value={query}
				/>
			</label>
		</div>
	);
}

function renderState(
	state: WordbookEntriesState,
	onRetry: () => void,
): JSX.Element {
	if (state.kind === "loading") {
		return <LoadingState />;
	}

	if (state.kind === "error") {
		return <ErrorState message={state.message} onRetry={onRetry} />;
	}

	return <WordbookTable entries={state.entries} />;
}

function getEntryCountLabel(
	state: WordbookEntriesState,
	query: string,
): string | null {
	if (state.kind !== "loaded") {
		return null;
	}

	const totalEntries = state.entries.length;
	if (query.trim().length === 0) {
		return `${totalEntries} words`;
	}

	const filteredEntries = filterWordbookEntries(state.entries, query);
	return `${filteredEntries.length} of ${totalEntries} words`;
}

export function App(): JSX.Element {
	const state = wordbookEntriesState.value;
	const searchQuery = wordbookSearchQuery.value;
	const exportErrorMessage = exportError.value;
	const wordbookEditErrorMessage = wordbookEditError.value;
	const canExport = state.kind === "loaded" && state.entries.length > 0;
	const entryCountLabel = getEntryCountLabel(state, searchQuery);
	const reloadWordbookEntries = useLoadOnMount(
		loadWordbookEntries,
		setWordbookLoadError,
	);
	useLoadOnMount(loadSettings, setSettingsLoadError);
	useLoadOnMount(loadSiteControl, setSiteControlLoadError);

	useEffect(() => {
		const handleKeydown = (event: KeyboardEvent): void => {
			if (event.key === "Escape") {
				clearDeletion();
				clearEditing();
			}
		};

		document.addEventListener("keydown", handleKeydown);
		return (): void => {
			document.removeEventListener("keydown", handleKeydown);
		};
	}, []);

	function handleExportClick(): void {
		if (state.kind !== "loaded" || state.entries.length === 0) {
			return;
		}

		try {
			const csv = buildLemmaCsv(state.entries);
			downloadCsvBlob("word-buddy.csv", csv);
			exportError.value = null;
		} catch (error: unknown) {
			exportError.value = toErrorMessage(error);
		}
	}

	return (
		<div className="min-h-screen bg-slate-50 text-slate-900">
			<main className="mx-auto max-w-6xl px-6 py-10">
				<div className="flex flex-col gap-6">
					<HeaderBar
						canExport={canExport}
						entryCountLabel={entryCountLabel}
						onExport={handleExportClick}
					/>
					<SettingsPanel />
					<SiteControlPanel />
					{state.kind === "loaded" ? (
						<WordbookToolbar query={searchQuery} />
					) : null}
					{exportErrorMessage === null ? null : (
						<Banner
							className={STATUS_BANNER_CLASS.error}
							message={exportErrorMessage}
						/>
					)}
					{wordbookEditErrorMessage === null ? null : (
						<Banner
							className={STATUS_BANNER_CLASS.error}
							message={wordbookEditErrorMessage}
						/>
					)}
					{renderState(state, reloadWordbookEntries)}
				</div>
			</main>
		</div>
	);
}
