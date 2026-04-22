import { useSignal } from "@preact/signals";
import type { JSX } from "preact";
import { useEffect } from "preact/hooks";

import {
	PRIMARY_BUTTON_CLASS,
	SECONDARY_BUTTON_CLASS,
	STATUS_BANNER_CLASS,
} from "@/shared/ui/styles";
import { toErrorMessage } from "@/shared/utils/errors";

import { loadPopup, type PopupState, popupState, togglePopup } from "./state";

type ToggleHint = "blocked" | "unblocked" | null;

function reportPopupError(error: unknown): void {
	popupState.value = {
		kind: "error",
		message: toErrorMessage(error),
	};
}

function StatusCard({
	children,
}: {
	readonly children: JSX.Element;
}): JSX.Element {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
			{children}
		</div>
	);
}

function HostLabel({ host }: { readonly host: string | null }): JSX.Element {
	return (
		<div>
			<p className="text-slate-500 text-xs uppercase tracking-wide">
				Current site
			</p>
			<p className="mt-1 break-all font-semibold text-slate-900 text-sm">
				{host ?? "No active site"}
			</p>
		</div>
	);
}

function RetryButton(): JSX.Element {
	return (
		<button
			className={PRIMARY_BUTTON_CLASS}
			onClick={(): void => {
				loadPopup().catch(reportPopupError);
			}}
			type="button"
		>
			Retry
		</button>
	);
}

function ToggleHintMessage({
	hint,
}: {
	readonly hint: ToggleHint;
}): JSX.Element | null {
	if (hint === "blocked") {
		return (
			<p className="text-amber-700 text-xs">
				Reload the page to clear any existing annotations.
			</p>
		);
	}

	if (hint === "unblocked") {
		return (
			<p className="text-emerald-700 text-xs">
				Reload the page to resume annotations.
			</p>
		);
	}

	return null;
}

function LoadingContent(): JSX.Element {
	return <div className="h-18 animate-pulse rounded-xl bg-slate-100" />;
}

function ErrorContent({ message }: { readonly message: string }): JSX.Element {
	return (
		<>
			<p className={STATUS_BANNER_CLASS.error}>{message}</p>
			<RetryButton />
		</>
	);
}

function ReadyContent({
	hint,
	onToggle,
	state,
}: {
	readonly hint: ToggleHint;
	readonly onToggle: () => void;
	readonly state: Extract<PopupState, { readonly kind: "ready" }>;
}): JSX.Element {
	return (
		<>
			<HostLabel host={state.host} />
			{state.host === null ? null : (
				<button
					className={PRIMARY_BUTTON_CLASS}
					onClick={onToggle}
					type="button"
				>
					{state.blocked ? "Resume on this site" : "Pause on this site"}
				</button>
			)}
			<ToggleHintMessage hint={hint} />
		</>
	);
}

function PopupContent({
	hint,
	onToggle,
	state,
}: {
	readonly hint: ToggleHint;
	readonly onToggle: () => void;
	readonly state: PopupState;
}): JSX.Element {
	if (state.kind === "loading") {
		return <LoadingContent />;
	}

	if (state.kind === "error") {
		return <ErrorContent message={state.message} />;
	}

	return <ReadyContent hint={hint} onToggle={onToggle} state={state} />;
}

export function App(): JSX.Element {
	const state = popupState.value;
	const lastToggle = useSignal<ToggleHint>(null);

	useEffect(() => {
		loadPopup().catch(reportPopupError);
	}, []);

	const handleToggle = (): void => {
		if (state.kind !== "ready" || state.host === null) {
			return;
		}

		const wasBlocked = state.blocked;
		togglePopup()
			.then((): void => {
				lastToggle.value = wasBlocked ? "unblocked" : "blocked";
			})
			.catch(reportPopupError);
	};

	return (
		<div className="w-70 min-w-70 bg-slate-50 p-3 text-slate-900">
			<div className="flex flex-col gap-3">
				<StatusCard>
					<div className="flex flex-col gap-3">
						<h1 className="font-semibold text-base text-slate-900">
							Word Buddy
						</h1>
						<PopupContent
							hint={lastToggle.value}
							onToggle={handleToggle}
							state={state}
						/>
					</div>
				</StatusCard>
				<button
					className={SECONDARY_BUTTON_CLASS}
					onClick={(): void => {
						browser.runtime.openOptionsPage().then((): void => {
							window.close();
						});
					}}
					type="button"
				>
					Open Word Buddy options
				</button>
			</div>
		</div>
	);
}
