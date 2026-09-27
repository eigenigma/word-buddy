import { type ReadonlySignal, type Signal, signal } from "@preact/signals";

import type { SelectionSnapshot, ViewportPoint } from "@/shared/dom/selection";
import { toErrorMessage } from "@/shared/utils/errors";

import type { TimerScheduler } from "./scheduler";
import type {
	SelectionBubbleUiState,
	SelectionCardUiState,
	SelectionPopupState,
	SelectionUiState,
} from "./state";

const SELECTION_READ_DELAY_MS = 50;
const ADDED_CARD_DISMISS_DELAY_MS = 150;

type UiStateSignal = Signal<SelectionUiState | null>;

export interface SelectionPopupControllerDependencies {
	readonly addToWordbook: (popup: SelectionPopupState) => Promise<void>;
	readonly readSelection: (point: ViewportPoint) => SelectionSnapshot | null;
	readonly reportError: (error: unknown) => void;
	readonly resolve: (
		selection: SelectionSnapshot,
	) => Promise<SelectionPopupState | null>;
	readonly scheduler: TimerScheduler;
}

export interface SelectionPopupController {
	readonly add: () => void;
	readonly hide: () => void;
	readonly open: () => void;
	readonly selectAt: (point: ViewportPoint) => void;
	readonly state: ReadonlySignal<SelectionUiState | null>;
}

// Every transition stores a new object, so a request whose starting state is
// no longer current has been dismissed or superseded, and drops its result.
function replaceIfCurrent(
	state: UiStateSignal,
	from: SelectionUiState,
	to: SelectionUiState | null,
): boolean {
	if (state.peek() !== from) {
		return false;
	}

	state.value = to;
	return true;
}

// Requests start from the scheduler, which starts nothing once the context is
// invalid.
function startRequest(
	state: UiStateSignal,
	scheduler: TimerScheduler,
	request: SelectionUiState,
	run: () => Promise<void>,
	onFailure: (error: unknown) => void,
): void {
	state.value = request;
	scheduler.schedule((): void => {
		run().catch(onFailure);
	}, 0);
}

async function resolveCard(
	state: UiStateSignal,
	request: SelectionBubbleUiState,
	resolve: SelectionPopupControllerDependencies["resolve"],
): Promise<void> {
	const popup = await resolve(request.selection);

	replaceIfCurrent(
		state,
		request,
		popup === null
			? null
			: {
					addError: null,
					adding: false,
					anchor: request.selection.rect,
					kind: "card",
					popup: popup,
				},
	);
}

async function addCard(
	state: UiStateSignal,
	request: SelectionCardUiState,
	addToWordbook: SelectionPopupControllerDependencies["addToWordbook"],
	scheduler: TimerScheduler,
): Promise<void> {
	await addToWordbook(request.popup);

	const added: SelectionCardUiState = {
		...request,
		adding: false,
		popup: { ...request.popup, alreadyAdded: true },
	};
	if (replaceIfCurrent(state, request, added)) {
		scheduler.schedule((): void => {
			replaceIfCurrent(state, added, null);
		}, ADDED_CARD_DISMISS_DELAY_MS);
	}
}

export function createSelectionPopupController({
	addToWordbook,
	readSelection,
	reportError,
	resolve,
	scheduler,
}: SelectionPopupControllerDependencies): SelectionPopupController {
	const state: UiStateSignal = signal(null);

	return {
		add: (): void => {
			const current = state.peek();
			if (current?.kind !== "card" || current.adding) {
				return;
			}

			const request = { ...current, addError: null, adding: true };
			startRequest(
				state,
				scheduler,
				request,
				() => addCard(state, request, addToWordbook, scheduler),
				(error: unknown): void => {
					replaceIfCurrent(state, request, {
						...request,
						addError: toErrorMessage(error),
						adding: false,
					});
				},
			);
		},
		hide: (): void => {
			state.value = null;
		},
		open: (): void => {
			const current = state.peek();
			if (current?.kind !== "bubble" || current.resolving) {
				return;
			}

			const request = { ...current, resolving: true };
			startRequest(
				state,
				scheduler,
				request,
				() => resolveCard(state, request, resolve),
				(error: unknown): void => {
					replaceIfCurrent(state, request, null);
					reportError(error);
				},
			);
		},
		selectAt: (point: ViewportPoint): void => {
			scheduler.schedule((): void => {
				try {
					const selection = readSelection(point);
					if (selection) {
						state.value = {
							kind: "bubble",
							resolving: false,
							selection: selection,
						};
					}
				} catch (error: unknown) {
					state.value = null;
					reportError(error);
				}
			}, SELECTION_READ_DELAY_MS);
		},
		state: state,
	};
}
