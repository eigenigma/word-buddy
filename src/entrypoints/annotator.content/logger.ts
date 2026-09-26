import { reportGlobalError, toErrorMessage } from "@/shared/utils/errors";

export interface AnnotatorLogger {
	readonly warn: (...messages: readonly unknown[]) => void;
}

function formatLogMessage(messages: readonly unknown[]): string {
	return messages.map((message) => toErrorMessage(message)).join(" ");
}

export function createAnnotatorLogger(): AnnotatorLogger {
	return {
		warn: (...messages: readonly unknown[]): void => {
			reportGlobalError(
				"[word-buddy annotator:warn]",
				formatLogMessage(messages),
			);
		},
	};
}
