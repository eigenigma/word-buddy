export const INJECTED_ATTRIBUTE = "data-wb-injected";
export const INJECTED_SELECTOR = `[${INJECTED_ATTRIBUTE}]`;
export const INJECTED_WORD_ATTRIBUTE = "data-wb-word";
const INJECTED_LEMMA_ATTRIBUTE = "data-wb-lemma";

export interface GlossSpanParts {
	readonly gloss: string;
	readonly lemma: string;
	readonly word: string;
}

// A gloss span holds a single `word(gloss)` text node and repeats the word in
// an attribute, so a reader can tell the page's word from the gloss.
export function createGlossSpan(
	documentRef: Document,
	parts: GlossSpanParts,
): HTMLSpanElement {
	const span = documentRef.createElement("span");
	span.setAttribute(INJECTED_ATTRIBUTE, "1");
	span.setAttribute(INJECTED_WORD_ATTRIBUTE, parts.word);
	span.setAttribute(INJECTED_LEMMA_ATTRIBUTE, parts.lemma);
	span.textContent = `${parts.word}(${parts.gloss})`;
	return span;
}
