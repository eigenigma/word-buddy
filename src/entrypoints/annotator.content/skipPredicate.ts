import { INJECTED_SELECTOR } from "@/shared/dom/injectedMarker";

export const BLOCK_SELECTOR =
	"p, li, td, th, blockquote, article, section, h1, h2, h3, h4, h5, h6, dt, dd, figcaption, summary";

// Content the annotator neither annotates nor reads.
const UNREAD_SELECTOR = [
	"script",
	"style",
	"code",
	"pre",
	"input",
	"textarea",
	"noscript",
	"svg",
	"math",
	"iframe",
	"template",
	'[contenteditable="true"]',
].join(", ");

// Its own glosses are read as their words but never annotated again.
const SKIPPED_SELECTOR = `${UNREAD_SELECTOR}, ${INJECTED_SELECTOR}`;

// Inside a block, nested candidate blocks own their own text.
const PRUNED_FROM_MATCHING_SELECTOR = `${SKIPPED_SELECTOR}, ${BLOCK_SELECTOR}`;
const PRUNED_FROM_PARAGRAPH_SELECTOR = `${UNREAD_SELECTOR}, ${BLOCK_SELECTOR}`;

export function isInSkippedSubtree(element: Element): boolean {
	return element.closest(SKIPPED_SELECTOR) !== null;
}

export function isPrunedFromMatching(element: Element): boolean {
	return element.matches(PRUNED_FROM_MATCHING_SELECTOR);
}

export function isPrunedFromParagraph(element: Element): boolean {
	return element.matches(PRUNED_FROM_PARAGRAPH_SELECTOR);
}
