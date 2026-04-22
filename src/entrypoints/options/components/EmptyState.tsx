import type { JSX } from "preact";

const EMPTY_STATE_TITLE = "No saved words yet";
const EMPTY_STATE_DESCRIPTION =
	"Select English text on a webpage, then click Add to wordbook in the popup.";

export function EmptyState(): JSX.Element {
	return (
		<div className="rounded-2xl border border-slate-300 border-dashed bg-white px-6 py-14 text-center shadow-sm">
			<h2 className="font-semibold text-slate-900 text-xl">
				{EMPTY_STATE_TITLE}
			</h2>
			<p className="mx-auto mt-3 max-w-2xl text-slate-600 text-sm leading-6">
				{EMPTY_STATE_DESCRIPTION}
			</p>
		</div>
	);
}
