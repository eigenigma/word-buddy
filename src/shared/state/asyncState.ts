import type { Signal } from "@preact/signals";

import { toErrorMessage } from "@/shared/utils/errors";

export async function runAsyncState<TValue, TState>(
	signal: Signal<TState>,
	loadingState: TState,
	run: () => Promise<TValue>,
	toReady: (value: TValue) => TState,
	toError: (message: string) => TState,
): Promise<void> {
	signal.value = loadingState;
	try {
		signal.value = toReady(await run());
	} catch (error: unknown) {
		signal.value = toError(toErrorMessage(error));
	}
}
