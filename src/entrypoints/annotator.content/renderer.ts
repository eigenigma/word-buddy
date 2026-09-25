import type { AhoCorasickMatch } from "@/shared/matching/ahoCorasick";

export interface RendererInput {
	readonly block: Element;
	readonly matchesByNode: ReadonlyMap<Text, readonly AhoCorasickMatch[]>;
	readonly translations: Readonly<Record<string, string>>;
}

function sortMatches(
	matches: readonly AhoCorasickMatch[],
): readonly AhoCorasickMatch[] {
	return [...matches].sort(
		(left, right) =>
			left.start - right.start ||
			right.end - left.end ||
			left.lemma.localeCompare(right.lemma),
	);
}

function createWrapperText(word: string, gloss: string): string {
	return `${word}(${gloss})`;
}

function createWrapperSpan(
	documentRef: Document,
	lemma: string,
	word: string,
	gloss: string,
): HTMLSpanElement {
	const wrapperSpan = documentRef.createElement("span");
	wrapperSpan.dataset["wbInjected"] = "1";
	wrapperSpan.dataset["wbLemma"] = lemma;
	wrapperSpan.textContent = createWrapperText(word, gloss);
	return wrapperSpan;
}

function renderTextNode(
	textNode: Text,
	matches: readonly AhoCorasickMatch[],
	translations: Readonly<Record<string, string>>,
): void {
	const sourceText = textNode.data;
	const documentRef = textNode.ownerDocument;
	const fragment = documentRef.createDocumentFragment();
	let cursor = 0;
	let rendered = false;

	for (const match of sortMatches(matches)) {
		if (match.start < cursor || match.end > sourceText.length) {
			continue;
		}

		const translation = translations[match.lemma];
		if (match.start > cursor) {
			fragment.append(sourceText.slice(cursor, match.start));
		}

		const word = sourceText.slice(match.start, match.end);
		if (translation === undefined) {
			fragment.append(word);
		} else {
			fragment.append(
				createWrapperSpan(documentRef, match.lemma, word, translation),
			);
			rendered = true;
		}

		cursor = match.end;
	}

	if (!rendered) {
		return;
	}

	if (cursor < sourceText.length) {
		fragment.append(sourceText.slice(cursor));
	}

	textNode.replaceWith(fragment);
}

export function renderAnnotations(input: RendererInput): void {
	for (const [textNode, matches] of input.matchesByNode) {
		if (matches.length === 0) {
			continue;
		}

		renderTextNode(textNode, matches, input.translations);
	}
}
