// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	restoreCheckVisibility,
	stubCheckVisibility,
} from "@/test-helpers/checkVisibility";
import { mountMarkup, rangeOf, textAt } from "@/test-helpers/dom";

import { createGlossSpan } from "./injectedMarker";
import {
	findEnclosingBlock,
	getSelectionRect,
	readActiveSelection,
	readSelectionContext,
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

// jsdom lays nothing out, so a range has no geometry until one is mocked.
function mockEmptyRangeGeometry(): void {
	mockRangeGeometry({ boundingRect: createRect(0, 0, 0, 0), clientRects: [] });
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

function createStyleDeclaration(display: string): CSSStyleDeclaration {
	const { style } = document.createElement("div");
	style.display = display;
	return style;
}

function resetDocumentBody(): void {
	document.body.replaceChildren();
}

function selectRange(
	start: readonly [Node, number],
	end: readonly [Node, number],
): Range {
	const range = rangeOf(start, end);
	const selection = globalThis.getSelection();
	if (!selection) {
		throw new Error("Selection API is unavailable in jsdom.");
	}

	selection.removeAllRanges();
	selection.addRange(range);
	return range;
}

function selectText(content: string, start: number, end: number): Range {
	const paragraph = document.createElement("p");
	const textNode = document.createTextNode(content);
	paragraph.append(textNode);
	document.body.append(paragraph);

	return selectRange([textNode, start], [textNode, end]);
}

function mountGlossParagraph(): {
	readonly after: Text;
	readonly before: Text;
	readonly glossText: Text;
} {
	const gloss = createGlossSpan(document, {
		gloss: "跑",
		lemma: "run",
		word: "run",
	});
	const glossText = gloss.firstChild;
	if (!(glossText instanceof Text)) {
		throw new Error("A gloss span starts with its text node.");
	}
	const before = document.createTextNode("We ");
	const after = document.createTextNode(" daily.");
	const paragraph = document.createElement("p");
	paragraph.append(before, gloss, after);
	document.body.append(paragraph);

	return { after: after, before: before, glossText: glossText };
}

beforeEach(() => {
	stubCheckVisibility((): boolean => true);
});

afterEach(() => {
	globalThis.getSelection()?.removeAllRanges();
	resetDocumentBody();
	restoreRangeGeometry();
	restoreCheckVisibility();
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
				createStyleDeclaration(element === block ? "block" : "inline"),
		);

		expect(findEnclosingBlock(textNode)).toBe(block);
	});

	it("skips block-level elements that are not HTML elements", () => {
		const block = document.createElement("p");
		const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		const textNode = document.createTextNode("agenda");
		svg.append(textNode);
		block.append(svg);
		document.body.append(block);

		vi.spyOn(globalThis, "getComputedStyle").mockImplementation(
			(element: Element): CSSStyleDeclaration =>
				createStyleDeclaration(
					element === block || element === svg ? "block" : "inline",
				),
		);

		expect(findEnclosingBlock(textNode)).toBe(block);
	});

	it("falls back to the document body when no block ancestor is found", () => {
		const inline = document.createElement("span");
		const textNode = document.createTextNode("agenda");
		inline.append(textNode);
		document.body.append(inline);

		vi.spyOn(globalThis, "getComputedStyle").mockImplementation(
			(): CSSStyleDeclaration => createStyleDeclaration("inline"),
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

	it("returns null for selections of only non-HTML whitespace", () => {
		selectText("a\u00a0\u2003b", 1, 3);

		expect(readActiveSelection(globalThis.window)).toBeNull();
	});

	it("returns a trimmed snapshot and clones the active range", () => {
		mockEmptyRangeGeometry();
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

describe("readActiveSelection across elements", () => {
	beforeEach(mockEmptyRangeGeometry);

	it("keeps a word whole across an element displayed inline", () => {
		const root = mountMarkup(
			'<div>hel<div style="display: inline">lo</div> there</div>',
		);
		selectRange([textAt(root, "div"), 0], [textAt(root, "[style]"), 2]);

		expect(readActiveSelection(globalThis.window)?.text).toBe("hello");
	});

	it("keeps a word whole across a hidden element", () => {
		const root = mountMarkup("<p>hel<span hidden>ignored</span>lo</p>");
		selectRange([textAt(root, "p"), 0], [textAt(root, "p", 2), 2]);

		expect(readActiveSelection(globalThis.window)?.text).toBe("hello");
	});
});

describe("readActiveSelection around glosses", () => {
	beforeEach(mockEmptyRangeGeometry);

	it("returns null when only gloss text is selected", () => {
		const { glossText } = mountGlossParagraph();
		selectRange([glossText, 4], [glossText, 6]);

		expect(readActiveSelection(globalThis.window)).toBeNull();
	});

	it("keeps only the word of a gloss the selection crosses", () => {
		const { after, before } = mountGlossParagraph();
		selectRange([before, 0], [after, 6]);

		expect(readActiveSelection(globalThis.window)?.text).toBe("We run daily");
	});

	it("reads the sentence around a word in a gloss without the gloss", () => {
		const { glossText } = mountGlossParagraph();
		selectRange([glossText, 0], [glossText, 3]);
		const selection = readActiveSelection(globalThis.window);
		if (selection === null) {
			throw new Error("Expected a selection.");
		}

		expect(readSelectionContext(selection)).toBe("We run daily.");
	});
});
