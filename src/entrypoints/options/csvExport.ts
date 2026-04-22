import type { WordbookEntry } from "@/shared/wordbook/types";

export function buildLemmaCsv(entries: readonly WordbookEntry[]): string {
	return `${entries.map((entry) => entry.lemma).join("\n")}\n`;
}

export function downloadCsvBlob(filename: string, csv: string): void {
	const blob = new Blob([csv], {
		type: "text/csv;charset=utf-8",
	});
	const objectUrl = URL.createObjectURL(blob);
	const downloadLink = document.createElement("a");

	downloadLink.download = filename;
	downloadLink.href = objectUrl;
	document.body.append(downloadLink);

	try {
		downloadLink.click();
	} finally {
		downloadLink.remove();
		URL.revokeObjectURL(objectUrl);
	}
}
