export function toErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

export function toError(error: unknown, fallbackMessage?: string): Error {
	if (error instanceof Error) {
		return error;
	}

	if (fallbackMessage !== undefined) {
		return new Error(fallbackMessage);
	}

	return new Error(String(error));
}

export function reportGlobalError(context: string, error: unknown): void {
	if (typeof globalThis.reportError !== "function") {
		return;
	}

	globalThis.reportError(new Error(`${context}: ${toErrorMessage(error)}`));
}
