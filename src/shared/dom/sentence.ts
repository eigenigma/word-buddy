function normalizeSentenceFragment(value: string): string {
	return value.replaceAll(/\s+/gu, " ").trim();
}

function splitIntoSentences(
	blockText: string,
	locale: string,
): readonly string[] {
	if (typeof Intl.Segmenter === "function") {
		const segmenter = new Intl.Segmenter(locale, {
			granularity: "sentence",
		});

		return Array.from(segmenter.segment(blockText), ({ segment }) => segment);
	}

	return blockText.split(/(?<=[.!?])\s+/u);
}

export function extractContainingSentence(
	blockText: string,
	selectionText: string,
	locale = "en",
): string {
	const normalizedBlockText = normalizeSentenceFragment(blockText);
	const normalizedSelectionText = normalizeSentenceFragment(selectionText);

	if (!normalizedBlockText) {
		return normalizedBlockText;
	}

	if (!normalizedSelectionText) {
		return normalizedBlockText;
	}

	const sentence = splitIntoSentences(blockText, locale)
		.map(normalizeSentenceFragment)
		.find((segment: string) => segment.includes(normalizedSelectionText));

	return sentence ?? normalizedBlockText;
}
