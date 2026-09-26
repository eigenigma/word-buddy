import { createGlossSpan } from "@/shared/dom/injectedMarker";
import type { AhoCorasickMatch } from "@/shared/matching/ahoCorasick";

// Replacing an attached text node queues exactly one childList record on its
// parent: the text node removed, the new nodes added in order. Only this
// replacement ever adds those new nodes, so they identify its record.
export interface TextReplacement {
	readonly added: readonly Node[];
	readonly removed: Text;
}

export interface RendererInput {
	readonly matchesByNode: ReadonlyMap<Text, readonly AhoCorasickMatch[]>;
	readonly onReplace: (replacement: TextReplacement) => void;
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

function buildAnnotatedFragment(
	textNode: Text,
	matches: readonly AhoCorasickMatch[],
	translations: Readonly<Record<string, string>>,
): DocumentFragment | null {
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
		return null;
	}

	if (cursor < sourceText.length) {
		fragment.append(sourceText.slice(cursor));
	}

	return fragment;
}

export function renderAnnotations(input: RendererInput): void {
	for (const [textNode, matches] of input.matchesByNode) {
		if (textNode.parentNode === null) {
			continue;
		}

		const fragment = buildAnnotatedFragment(
			textNode,
			matches,
			input.translations,
		);
		if (fragment === null) {
			continue;
		}

		input.onReplace({
			added: Array.from(fragment.childNodes),
			removed: textNode,
		});
		textNode.replaceWith(fragment);
	}
}
