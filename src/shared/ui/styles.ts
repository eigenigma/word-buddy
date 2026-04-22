export const PANEL_CLASS =
	"rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm";

export const INPUT_CLASS =
	"rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 text-sm outline-none transition focus:border-slate-400";

export const PRIMARY_BUTTON_CLASS =
	"rounded-xl bg-slate-900 px-4 py-2 font-medium text-sm text-white transition hover:bg-slate-800";

export const SECONDARY_BUTTON_CLASS =
	"rounded-xl border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 text-sm transition hover:bg-slate-50";

export const SECONDARY_BUTTON_TALL_MUTED_CLASS =
	"rounded-xl border border-slate-200 bg-white px-4 py-3 font-medium text-slate-600 text-sm transition hover:bg-slate-50";

export const DISABLED_BUTTON_CLASS =
	"rounded-xl border border-slate-200 bg-slate-100 px-4 py-2 font-medium text-slate-400 text-sm";

export const STATUS_BANNER_CLASS = {
	error:
		"rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-600 text-sm",
	info: "rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sky-700 text-sm",
	success:
		"rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-700 text-sm",
	warning:
		"rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-700 text-sm",
} as const;
