import { useSignal } from "@preact/signals";
import type { JSX } from "preact";

import type { TextInputEvent } from "@/shared/dom/events";
import { normalizeHostInput } from "@/shared/siteControl/types";
import { INPUT_CLASS, PANEL_CLASS } from "@/shared/ui/styles";
import { toErrorMessage } from "@/shared/utils/errors";

import {
	loadSiteControl,
	setHostBlocked,
	siteControlPanelState,
} from "../siteControlData";

interface BlockedHostListProps {
	readonly blockedHosts: readonly string[];
	readonly disabled: boolean;
	readonly onRemove: (host: string) => void;
}

interface HostAddFormProps {
	readonly disabled: boolean;
	readonly inputError: string | null;
	readonly onInput: (event: TextInputEvent) => void;
	readonly onSubmit: () => void;
	readonly value: string;
}

interface ReadyStateProps {
	readonly blockedHosts: readonly string[];
}

function reportSiteControlLoadError(error: unknown): void {
	siteControlPanelState.value = {
		kind: "error",
		message: toErrorMessage(error),
	};
}

function PanelHeader(): JSX.Element {
	return (
		<div>
			<h2 className="font-semibold text-slate-900 text-xl">Blocked sites</h2>
			<p className="mt-1 text-slate-500 text-sm">
				Pause inline annotations on specific hosts.
			</p>
		</div>
	);
}

function LoadingState(): JSX.Element {
	return (
		<section className={PANEL_CLASS}>
			<PanelHeader />
			<div className="mt-4 h-24 animate-pulse rounded-2xl bg-slate-100" />
		</section>
	);
}

function ErrorState({ message }: { readonly message: string }): JSX.Element {
	return (
		<section className={PANEL_CLASS}>
			<PanelHeader />
			<p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-600 text-sm">
				{message}
			</p>
			<button
				className="mt-4 rounded-lg bg-slate-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-slate-800"
				onClick={(): void => {
					loadSiteControl().catch(reportSiteControlLoadError);
				}}
				type="button"
			>
				Retry
			</button>
		</section>
	);
}

function HostAddForm({
	disabled,
	inputError,
	onInput,
	onSubmit,
	value,
}: HostAddFormProps): JSX.Element {
	return (
		<>
			<div className="mt-5 flex flex-col gap-3 sm:flex-row">
				<input
					className={`${INPUT_CLASS} min-w-0 flex-1`}
					onInput={onInput}
					placeholder="example.com or https://example.com/path"
					type="text"
					value={value}
				/>
				<button
					className="rounded-xl bg-slate-900 px-4 py-3 font-medium text-sm text-white transition hover:bg-slate-800 disabled:border disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
					disabled={disabled}
					onClick={onSubmit}
					type="button"
				>
					Add host
				</button>
			</div>
			{inputError === null ? null : (
				<p className="mt-3 text-rose-600 text-sm">{inputError}</p>
			)}
		</>
	);
}

function BlockedHostList({
	blockedHosts,
	disabled,
	onRemove,
}: BlockedHostListProps): JSX.Element {
	if (blockedHosts.length === 0) {
		return (
			<p className="rounded-xl border border-slate-200 border-dashed px-4 py-4 text-slate-500 text-sm">
				No blocked hosts yet.
			</p>
		);
	}

	return (
		<ul className="grid gap-3">
			{blockedHosts.map((host) => (
				<li
					className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3"
					key={host}
				>
					<span className="break-all font-medium text-slate-800 text-sm">
						{host}
					</span>
					<button
						className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-medium text-slate-600 text-sm transition hover:bg-slate-50 disabled:bg-slate-100 disabled:text-slate-400"
						disabled={disabled}
						onClick={(): void => {
							onRemove(host);
						}}
						type="button"
					>
						Remove
					</button>
				</li>
			))}
		</ul>
	);
}

function ReadyState({ blockedHosts }: ReadyStateProps): JSX.Element {
	const inputValue = useSignal("");
	const inputError = useSignal<string | null>(null);
	const pendingHost = useSignal<string | null>(null);
	const isPending = pendingHost.value !== null;

	const handleAdd = async (): Promise<void> => {
		const normalizedHost = normalizeHostInput(inputValue.value);
		if (normalizedHost === null) {
			inputError.value = "Enter a valid URL or hostname.";
			return;
		}

		pendingHost.value = normalizedHost;
		inputError.value = null;
		try {
			await setHostBlocked(normalizedHost, true);
			inputValue.value = "";
		} finally {
			pendingHost.value = null;
		}
	};

	const handleRemove = async (host: string): Promise<void> => {
		pendingHost.value = host;
		inputError.value = null;
		try {
			await setHostBlocked(host, false);
		} finally {
			pendingHost.value = null;
		}
	};

	return (
		<section className={PANEL_CLASS}>
			<PanelHeader />
			<HostAddForm
				disabled={isPending}
				inputError={inputError.value}
				onInput={(event: TextInputEvent): void => {
					inputValue.value = event.currentTarget.value;
					if (inputError.value !== null) {
						inputError.value = null;
					}
				}}
				onSubmit={handleAdd}
				value={inputValue.value}
			/>
			<div className="mt-5">
				<BlockedHostList
					blockedHosts={blockedHosts}
					disabled={isPending}
					onRemove={handleRemove}
				/>
			</div>
		</section>
	);
}

export function SiteControlPanel(): JSX.Element {
	const state = siteControlPanelState.value;

	if (state.kind === "loading") {
		return <LoadingState />;
	}

	if (state.kind === "error") {
		return <ErrorState message={state.message} />;
	}

	return <ReadyState blockedHosts={state.state.blockedHosts} />;
}
