import type { JSX } from "preact";

import { STATUS_BANNER_CLASS } from "@/shared/ui/styles";
import { toErrorMessage } from "@/shared/utils/errors";

import {
	clearTranslationCache,
	type TranslationCacheClearState,
	translationCacheClearState,
} from "../settingsData";

function reportTranslationCacheClearError(error: unknown): void {
	translationCacheClearState.value = {
		kind: "error",
		message: toErrorMessage(error),
	};
}

function TranslationCacheStatus({
	state,
}: {
	readonly state: TranslationCacheClearState;
}): JSX.Element | null {
	switch (state.kind) {
		case "idle": {
			return null;
		}
		case "clearing": {
			return (
				<p className={STATUS_BANNER_CLASS.info}>
					Clearing translation cache...
				</p>
			);
		}
		case "cleared": {
			const translationLabel =
				state.clearedCount === 1 ? "cached translation" : "cached translations";
			return (
				<p className={STATUS_BANNER_CLASS.success}>
					Cleared {state.clearedCount} {translationLabel}
				</p>
			);
		}
		case "error": {
			return <p className={STATUS_BANNER_CLASS.error}>{state.message}</p>;
		}
		default: {
			const exhaustiveState: never = state;
			throw new Error(
				`Unknown translation cache state: ${String(exhaustiveState)}`,
			);
		}
	}
}

export function TranslationCacheSection(): JSX.Element {
	const state = translationCacheClearState.value;
	const isClearing = state.kind === "clearing";

	return (
		<div className="mt-6 border-slate-200 border-t pt-5">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 className="font-medium text-slate-900 text-sm">
						LLM translation cache
					</h3>
					<p className="mt-1 text-slate-500 text-sm">
						Clear cached paragraph translations so future annotations fetch
						fresh results.
					</p>
				</div>
				<button
					className={
						isClearing
							? "rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 font-medium text-slate-400 text-sm"
							: "rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 text-sm transition hover:bg-slate-50"
					}
					disabled={isClearing}
					onClick={(): void => {
						clearTranslationCache().catch(reportTranslationCacheClearError);
					}}
					type="button"
				>
					{isClearing ? "Clearing..." : "Clear cache"}
				</button>
			</div>
			<div className="mt-4">
				<TranslationCacheStatus state={state} />
			</div>
		</div>
	);
}
