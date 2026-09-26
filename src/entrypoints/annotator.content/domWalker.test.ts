// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
	createGlossSpan,
	INJECTED_ATTRIBUTE,
} from "@/shared/dom/injectedMarker";
import { mountBlock } from "@/test-helpers/dom";
import { collectBlockTextNodes, readBlockSourceText } from "./domWalker";

function createBlock(
	tagName: string,
	...children: readonly (Node | string)[]
): HTMLElement {
	const block = document.createElement(tagName);
	block.append(...children);
	document.body.append(block);
	return block;
}

function createElementWithText(tagName: string, text: string): HTMLElement {
	const element = document.createElement(tagName);
	element.append(text);
	return element;
}

function collectTexts(block: Element): readonly string[] {
	return collectBlockTextNodes(block).map((textNode) => textNode.data);
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("collectBlockTextNodes", () => {
	it("collects every non-empty text node in document order", () => {
		const block = createBlock(
			"p",
			"The cat ",
			createElementWithText("em", "sat"),
			document.createTextNode(""),
			" here.",
		);

		expect(collectTexts(block)).toStrictEqual(["The cat ", "sat", " here."]);
	});

	it.each([
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
	])("skips text inside <%s>", (tagName: string) => {
		const skipped = document.createElement(tagName);
		skipped.append(createElementWithText("span", "hidden"));
		const block = createBlock("p", "before ", skipped, " after");

		expect(collectTexts(block)).toStrictEqual(["before ", " after"]);
	});

	it("skips editable subtrees but keeps explicitly non-editable ones", () => {
		const editable = createElementWithText("span", "editable");
		editable.setAttribute("contenteditable", "true");
		const nonEditable = createElementWithText("span", "fixed");
		nonEditable.setAttribute("contenteditable", "false");
		const block = createBlock("p", editable, nonEditable);

		expect(collectTexts(block)).toStrictEqual(["fixed"]);
	});

	it("skips glosses already injected into the block", () => {
		const gloss = createGlossSpan(document, {
			gloss: "猫",
			lemma: "cat",
			word: "cat",
		});
		const block = createBlock("p", "The ", gloss, " sat.");

		expect(collectTexts(block)).toStrictEqual(["The ", " sat."]);
	});

	it("returns no text nodes for a block that is itself skipped", () => {
		const block = createElementWithText("pre", "code sample");
		document.body.append(block);

		expect(collectTexts(block)).toStrictEqual([]);
	});

	it.each([
		["an injected gloss", "span", INJECTED_ATTRIBUTE, "1"],
		["an editor", "div", "contenteditable", "true"],
		["a code block", "pre", "class", "language-ts"],
	])(
		"returns no text nodes for a block inside %s",
		(_label: string, tagName: string, attributeName: string, attributeValue: string) => {
			const ancestor = document.createElement(tagName);
			ancestor.setAttribute(attributeName, attributeValue);
			const block = createElementWithText("p", "word");
			const container = document.createElement("div");
			container.append(block);
			ancestor.append(container);
			document.body.append(ancestor);

			expect(collectTexts(block)).toStrictEqual([]);
		},
	);
});

describe("collectBlockTextNodes ownership", () => {
	it("leaves the text of a nested candidate block to that block", () => {
		const nested = createElementWithText("p", "nested");
		const block = createBlock("li", "intro ", nested, " tail");

		expect(collectTexts(block)).toStrictEqual(["intro ", " tail"]);
		expect(collectTexts(nested)).toStrictEqual(["nested"]);
	});
});

describe("readBlockSourceText", () => {
	it("reads only the block's own text, with each gloss as its word", () => {
		const gloss = createGlossSpan(document, {
			gloss: "跑",
			lemma: "run",
			word: "run",
		});
		const block = createBlock(
			"li",
			"We ",
			gloss,
			" with ",
			createElementWithText("code", "map"),
			" daily",
			createElementWithText("p", "nested text"),
			"then rest.",
		);

		expect(readBlockSourceText(block)).toBe("We run with daily\nthen rest.");
	});

	it("keeps the words around skipped content apart", () => {
		const block = createBlock(
			"li",
			"Use",
			createElementWithText("code", "map"),
			"here",
			createElementWithText("style", "p {}"),
			"now",
			createElementWithText("p", "nested"),
			"after",
		);

		expect(readBlockSourceText(block)).toBe("Use here now\nafter");
	});

	it("breaks lines at structural tags it reads through", () => {
		const block = mountBlock("<li>one<div>two</div>three<br>four</li>");

		expect(readBlockSourceText(block)).toBe("one\ntwo\nthree\nfour");
	});
});
