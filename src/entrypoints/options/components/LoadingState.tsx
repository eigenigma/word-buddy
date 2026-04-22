import type { JSX } from "preact";

const LOADING_LABEL = "Loading wordbook...";

export function LoadingState(): JSX.Element {
	return (
		<div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
			<div className="mx-auto h-10 w-10 animate-pulse rounded-full bg-slate-200" />
			<p className="mt-4 text-slate-500 text-sm">{LOADING_LABEL}</p>
		</div>
	);
}
