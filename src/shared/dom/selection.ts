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

function resolveElement(node: Node): Element | null {
	if (node instanceof Element) {
		return node;
	}

	return node.parentElement;
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

export function findEnclosingBlock(node: Node): Element {
	let currentElement = resolveElement(node);
	const ownerWindow = node.ownerDocument?.defaultView ?? globalThis.window;

	while (currentElement) {
		const display = ownerWindow.getComputedStyle(currentElement).display;

		if (BLOCK_DISPLAY_VALUES.has(display)) {
			return currentElement;
		}

		currentElement = currentElement.parentElement;
	}

	const fallbackElement =
		node.ownerDocument?.body ?? node.ownerDocument?.documentElement;

	if (fallbackElement) {
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

	const text = selection.toString().trim();

	if (!text) {
		return null;
	}

	const range = selection.getRangeAt(0).cloneRange();

	return {
		range: range,
		rect: getSelectionRect(range, fallbackPoint),
		text: text,
	};
}
