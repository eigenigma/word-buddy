import { createGlossSpan } from "@/shared/dom/injectedMarker";
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
				createGlossSpan(documentRef, {
					gloss: translation,
					lemma: match.lemma,
					word: word,
				}),
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
