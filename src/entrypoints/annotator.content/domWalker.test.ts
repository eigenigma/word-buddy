// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { collectBlockTextNodes } from "./domWalker";
import { INJECTED_ATTRIBUTE } from "./injectedMarker";

function createBlock(...children: readonly (Node | string)[]): HTMLElement {
	const block = document.createElement("p");
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
		const block = createBlock("before ", skipped, " after");

		expect(collectTexts(block)).toStrictEqual(["before ", " after"]);
	});

	it("skips editable subtrees but keeps explicitly non-editable ones", () => {
		const editable = createElementWithText("span", "editable");
		editable.setAttribute("contenteditable", "true");
		const nonEditable = createElementWithText("span", "fixed");
		nonEditable.setAttribute("contenteditable", "false");
		const block = createBlock(editable, nonEditable);

		expect(collectTexts(block)).toStrictEqual(["fixed"]);
	});

	it("skips glosses already injected into the block", () => {
		const gloss = createElementWithText("span", "cat(猫)");
		gloss.setAttribute(INJECTED_ATTRIBUTE, "1");
		const block = createBlock("The ", gloss, " sat.");

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
