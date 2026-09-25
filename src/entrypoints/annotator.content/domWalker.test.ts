// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { collectBlockTextNodes } from "./domWalker";

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
		gloss.setAttribute("data-wb-injected", "1");
		const block = createBlock("The ", gloss, " sat.");

		expect(collectTexts(block)).toStrictEqual(["The ", " sat."]);
	});

	it("returns no text nodes for a block that is itself skipped", () => {
		const block = createElementWithText("pre", "code sample");
		document.body.append(block);

		expect(collectBlockTextNodes(block)).toStrictEqual([]);
	});

	it("returns no text nodes for blocks inside injected annotations", () => {
		const wrapper = document.createElement("span");
		wrapper.setAttribute("data-wb-injected", "1");
		const block = createElementWithText("p", "word");
		wrapper.append(block);
		document.body.append(wrapper);

		expect(collectBlockTextNodes(block)).toStrictEqual([]);
	});
});
