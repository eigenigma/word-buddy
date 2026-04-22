// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	findEnclosingBlock,
	getSelectionRect,
	readActiveSelection,
} from "./selection";

const ORIGINAL_GET_BOUNDING_CLIENT_RECT = Object.getOwnPropertyDescriptor(
	Range.prototype,
	"getBoundingClientRect",
);
const ORIGINAL_GET_CLIENT_RECTS = Object.getOwnPropertyDescriptor(
	Range.prototype,
	"getClientRects",
);

function createRect(
	x: number,
	y: number,
	width: number,
	height: number,
): DOMRect {
	return new DOMRect(x, y, width, height);
}

function toRectSnapshot(rect: DOMRect): {
	readonly height: number;
	readonly width: number;
	readonly x: number;
	readonly y: number;
} {
	return {
		height: rect.height,
		width: rect.width,
		x: rect.x,
		y: rect.y,
	};
}

function mockRangeGeometry(options: {
	readonly boundingRect: DOMRect;
	readonly clientRects: readonly DOMRect[];
}): void {
	Object.defineProperty(Range.prototype, "getClientRects", {
		configurable: true,
		value: (): readonly DOMRect[] => options.clientRects,
	});
	Object.defineProperty(Range.prototype, "getBoundingClientRect", {
		configurable: true,
		value: (): DOMRect => options.boundingRect,
	});
}

function restoreRangeGeometry(): void {
	if (ORIGINAL_GET_CLIENT_RECTS) {
		Object.defineProperty(
			Range.prototype,
			"getClientRects",
			ORIGINAL_GET_CLIENT_RECTS,
		);
	} else {
		Reflect.deleteProperty(Range.prototype, "getClientRects");
	}

	if (ORIGINAL_GET_BOUNDING_CLIENT_RECT) {
		Object.defineProperty(
			Range.prototype,
			"getBoundingClientRect",
			ORIGINAL_GET_BOUNDING_CLIENT_RECT,
		);
	} else {
		Reflect.deleteProperty(Range.prototype, "getBoundingClientRect");
	}
}

function resetDocumentBody(): void {
	document.body.replaceChildren();
}

function selectText(content: string, start: number, end: number): Range {
	const paragraph = document.createElement("p");
	const textNode = document.createTextNode(content);
	paragraph.append(textNode);
	document.body.append(paragraph);

	const range = document.createRange();
	range.setStart(textNode, start);
	range.setEnd(textNode, end);

	const selection = globalThis.getSelection();
	if (!selection) {
		throw new Error("Selection API is unavailable in jsdom.");
	}

	selection.removeAllRanges();
	selection.addRange(range);
	return range;
}

beforeEach(() => {
	resetDocumentBody();
	globalThis.getSelection()?.removeAllRanges();
	restoreRangeGeometry();
	vi.restoreAllMocks();
});

afterEach(() => {
	globalThis.getSelection()?.removeAllRanges();
	resetDocumentBody();
	restoreRangeGeometry();
	vi.restoreAllMocks();
});

describe("getSelectionRect", () => {
	it("prefers the first visible client rect", () => {
		mockRangeGeometry({
			boundingRect: createRect(2, 4, 6, 8),
			clientRects: [createRect(0, 0, 0, 0), createRect(10, 20, 30, 40)],
		});

		const rect = getSelectionRect(document.createRange());

		expect(toRectSnapshot(rect)).toEqual({
			height: 40,
			width: 30,
			x: 10,
			y: 20,
		});
	});

	it("falls back to the bounding rect when all client rects are hidden", () => {
		mockRangeGeometry({
			boundingRect: createRect(5, 6, 7, 8),
			clientRects: [createRect(0, 0, 0, 0)],
		});

		const rect = getSelectionRect(document.createRange());

		expect(toRectSnapshot(rect)).toEqual({
			height: 8,
			width: 7,
			x: 5,
			y: 6,
		});
	});

	it("falls back to the provided point when no geometry is visible", () => {
		mockRangeGeometry({
			boundingRect: createRect(0, 0, 0, 0),
			clientRects: [],
		});

		const rect = getSelectionRect(document.createRange(), { x: 13, y: 17 });

		expect(toRectSnapshot(rect)).toEqual({
			height: 0,
			width: 0,
			x: 13,
			y: 17,
		});
	});
});

describe("findEnclosingBlock", () => {
	it("returns the nearest block ancestor", () => {
		const block = document.createElement("div");
		const inline = document.createElement("span");
		const textNode = document.createTextNode("agenda");
		inline.append(textNode);
		block.append(inline);
		document.body.append(block);

		vi.spyOn(globalThis, "getComputedStyle").mockImplementation(
			(element: Element): CSSStyleDeclaration =>
				({
					display: element === block ? "block" : "inline",
				}) as CSSStyleDeclaration,
		);

		expect(findEnclosingBlock(textNode)).toBe(block);
	});

	it("falls back to the document body when no block ancestor is found", () => {
		const inline = document.createElement("span");
		const textNode = document.createTextNode("agenda");
		inline.append(textNode);
		document.body.append(inline);

		vi.spyOn(globalThis, "getComputedStyle").mockImplementation(
			(): CSSStyleDeclaration => ({ display: "inline" }) as CSSStyleDeclaration,
		);

		expect(findEnclosingBlock(textNode)).toBe(document.body);
	});
});

describe("readActiveSelection", () => {
	it("returns null for collapsed selections", () => {
		selectText("agenda", 2, 2);

		expect(readActiveSelection(globalThis.window)).toBeNull();
	});

	it("returns null for whitespace-only selections", () => {
		selectText("   ", 0, 3);

		expect(readActiveSelection(globalThis.window)).toBeNull();
	});

	it("returns a trimmed snapshot and clones the active range", () => {
		mockRangeGeometry({
			boundingRect: createRect(0, 0, 0, 0),
			clientRects: [],
		});
		const range = selectText("  agenda  ", 0, 10);

		const snapshot = readActiveSelection(globalThis.window, { x: 21, y: 34 });

		expect(snapshot).not.toBeNull();
		expect(snapshot?.text).toBe("agenda");
		expect(snapshot?.range).not.toBe(range);
		expect(toRectSnapshot(snapshot?.rect ?? createRect(0, 0, 0, 0))).toEqual({
			height: 0,
			width: 0,
			x: 21,
			y: 34,
		});
	});
});
