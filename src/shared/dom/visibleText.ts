import { readComputedStyle } from "./element";
import type { Separator, SourceTextPolicy, TextBoundary } from "./sourceText";

// Block-level displays that do not start with "block"; computed values use
// the short keyword form.
const LINE_BREAKING_DISPLAYS = new Set([
	"-webkit-box",
	"flex",
	"flow-root",
	"grid",
	"list-item",
	"table",
	"table-caption",
	"table-footer-group",
	"table-header-group",
	"table-row",
	"table-row-group",
]);

// Visibility is judged per text node: checkVisibility is false for an element
// without a box, and a `display: contents` parent has none even when its text
// renders, so the box check climbs past it while visibility, which text
// inherits, comes from the parent itself.
function isTextVisible(text: Text): boolean {
	const parent = text.parentElement;
	if (parent === null) {
		return false;
	}

	if (readComputedStyle(parent).visibility !== "visible") {
		return false;
	}

	let boxedElement: Element | null = parent;
	while (
		boxedElement !== null &&
		readComputedStyle(boxedElement).display === "contents"
	) {
		boxedElement = boxedElement.parentElement;
	}

	return boxedElement?.checkVisibility() ?? false;
}

// As in innerText, the outer display decides: block-level boxes break the
// line, table cells are tab-separated, and inline-level boxes join.
function readDisplayBoundary(element: Element): TextBoundary {
	const { display } = readComputedStyle(element);
	if (display === "table-cell") {
		return "\t";
	}

	return display.startsWith("block") || LINE_BREAKING_DISPLAYS.has(display)
		? "\n"
		: "";
}

export const VISIBLE_TEXT_POLICY: SourceTextPolicy = {
	boundaryAround: readDisplayBoundary,
	isPruned: (element: Element): boolean =>
		readComputedStyle(element).display === "none",
	isTextIncluded: isTextVisible,
	// An unrendered subtree leaves no trace, so a word it splits stays whole.
	separatorForPruned: (): Separator => "",
};
