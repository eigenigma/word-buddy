import { reportGlobalError, toErrorMessage } from "@/shared/utils/errors";

export interface AnnotatorLogger {
	readonly info: (...messages: readonly unknown[]) => void;
	readonly warn: (...messages: readonly unknown[]) => void;
}

type AnnotatorLogLevel = "info" | "warn";

function formatLogMessage(messages: readonly unknown[]): string {
	return messages.map((message) => toErrorMessage(message)).join(" ");
}

export function createAnnotatorLogger(): AnnotatorLogger {
	const report = (
		level: AnnotatorLogLevel,
		...messages: readonly unknown[]
	): void => {
		reportGlobalError(
			`[word-buddy annotator:${level}]`,
			new Error(formatLogMessage(messages)),
		);
	};

	return {
		info: (...messages: readonly unknown[]): void => {
			report("info", ...messages);
		},
		warn: (...messages: readonly unknown[]): void => {
			report("warn", ...messages);
		},
	};
}
