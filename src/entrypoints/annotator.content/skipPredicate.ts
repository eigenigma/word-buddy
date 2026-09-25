import { INJECTED_SELECTOR } from "./injectedMarker";

export const BLOCK_SELECTOR =
	"p, li, td, th, blockquote, article section, h1, h2, h3, h4, h5, h6, dt, dd, figcaption, summary";

const SKIPPED_SELECTOR = [
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
	INJECTED_SELECTOR,
].join(", ");

export function isSkippedElement(element: Element): boolean {
	return element.matches(SKIPPED_SELECTOR);
}
