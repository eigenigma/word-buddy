export interface InvalidationController {
	readonly dispose: () => void;
	readonly onInvalidate: () => Promise<void>;
}

export interface InvalidationControllerDependencies {
	readonly rebuildMatcher: () => Promise<void>;
	readonly rescanDocument: () => Promise<void>;
}

export function createInvalidationController(
	dependencies: InvalidationControllerDependencies,
): InvalidationController {
	let disposed = false;
	let invalidationInFlight: Promise<void> | null = null;
	let pending = false;

	const runInvalidation = async (): Promise<void> => {
		do {
			pending = false;
			if (disposed) {
				return;
			}

			await dependencies.rebuildMatcher();
			if (disposed) {
				return;
			}

			await dependencies.rescanDocument();
		} while (!disposed && pending);
	};

	return {
		dispose: (): void => {
			disposed = true;
			pending = false;
		},
		onInvalidate: async (): Promise<void> => {
			if (disposed) {
				return;
			}

			if (invalidationInFlight !== null) {
				pending = true;
				await invalidationInFlight;
				return;
			}

			invalidationInFlight = runInvalidation().finally((): void => {
				invalidationInFlight = null;
			});
			await invalidationInFlight;
		},
	};
}
