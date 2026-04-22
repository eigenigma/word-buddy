import { DEFAULT_WALKER_CONFIG } from "@/shared/matching";

export const BLOCK_SELECTOR =
	"p, li, td, th, blockquote, article section, h1, h2, h3, h4, h5, h6, dt, dd, figcaption, summary";

export function hasSkippedAttribute(element: Element): boolean {
	for (const [
		attributeName,
		expectedValue,
	] of DEFAULT_WALKER_CONFIG.skipAttributes) {
		const actualValue = element.getAttribute(attributeName);
		if (actualValue === null) {
			continue;
		}

		if (expectedValue === "" || actualValue === expectedValue) {
			return true;
		}
	}

	return false;
}

export function isSkippedElement(element: Element): boolean {
	return (
		DEFAULT_WALKER_CONFIG.skipTags.has(element.tagName.toLowerCase()) ||
		hasSkippedAttribute(element)
	);
}
