import { readComputedStyle, resolveElement } from "./element";
import { extractContainingSentence } from "./sentence";
import { readRangeSourceText, readSourceText } from "./sourceText";
import { VISIBLE_TEXT_POLICY } from "./visibleText";

const BLOCK_DISPLAY_VALUES = new Set([
	"block",
	"flex",
	"grid",
	"list-item",
	"table",
]);

export interface SelectionSnapshot {
	readonly range: Range;
	readonly rect: DOMRect;
	readonly text: string;
}

export interface ViewportPoint {
	readonly x: number;
	readonly y: number;
}

function snapshotRect(rect: DOMRect | DOMRectReadOnly): DOMRect {
	return new DOMRect(rect.x, rect.y, rect.width, rect.height);
}

function isVisibleRect(rect: DOMRect | DOMRectReadOnly): boolean {
	return rect.width > 0 || rect.height > 0;
}

export function getSelectionRect(
	range: Range,
	fallbackPoint?: ViewportPoint,
): DOMRect {
	const firstClientRect = Array.from(range.getClientRects()).find(
		(rect: DOMRect) => isVisibleRect(rect),
	);
	const boundingRect = range.getBoundingClientRect();

	if (firstClientRect) {
		return snapshotRect(firstClientRect);
	}

	if (isVisibleRect(boundingRect)) {
		return snapshotRect(boundingRect);
	}

	if (fallbackPoint) {
		return new DOMRect(fallbackPoint.x, fallbackPoint.y, 0, 0);
	}

	return snapshotRect(boundingRect);
}

export function findEnclosingBlock(node: Node): HTMLElement {
	let currentElement = resolveElement(node);

	while (currentElement) {
		if (
			currentElement instanceof HTMLElement &&
			BLOCK_DISPLAY_VALUES.has(readComputedStyle(currentElement).display)
		) {
			return currentElement;
		}

		currentElement = currentElement.parentElement;
	}

	const fallbackElement =
		node.ownerDocument?.body ?? node.ownerDocument?.documentElement;

	if (fallbackElement instanceof HTMLElement) {
		return fallbackElement;
	}

	throw new Error("Could not resolve an enclosing block element.");
}

export function readActiveSelection(
	targetWindow: Window,
	fallbackPoint?: ViewportPoint,
): SelectionSnapshot | null {
	const selection = targetWindow.getSelection();

	if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
		return null;
	}

	const range = selection.getRangeAt(0).cloneRange();
	// Source text collapses only HTML whitespace, so a selection of other
	// Unicode spaces such as nbsp still has to be caught here.
	const text = readRangeSourceText(range, VISIBLE_TEXT_POLICY).trim();

	if (text === "") {
		return null;
	}

	return {
		range: range,
		rect: getSelectionRect(range, fallbackPoint),
		text: text,
	};
}

// The sentence is read with the same policy as the selected word, so the word
// can be found in it.
export function readSelectionContext(selection: SelectionSnapshot): string {
	const block = findEnclosingBlock(selection.range.commonAncestorContainer);
	return extractContainingSentence(
		readSourceText(block, VISIBLE_TEXT_POLICY),
		selection.text,
	);
}
