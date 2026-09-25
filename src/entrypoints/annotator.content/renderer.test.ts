// @vitest-environment jsdom
import { assert, describe, expect, it } from "vitest";

import type { AhoCorasickMatch } from "@/shared/matching/ahoCorasick";
import { INJECTED_ATTRIBUTE } from "./injectedMarker";
import { renderAnnotations } from "./renderer";

const MATCH: AhoCorasickMatch = {
	end: 4,
	lemma: "word",
	start: 0,
	surface: "word",
};

function createBlockWithText(text: string): {
	readonly block: HTMLParagraphElement;
	readonly textNode: Text;
} {
	const block = document.createElement("p");
	const textNode = document.createTextNode(text);
	block.append(textNode);
	return { block: block, textNode: textNode };
}

function renderWord(
	block: Element,
	textNode: Text,
	translation: string | undefined,
): void {
	renderAnnotations({
		block: block,
		matchesByNode: new Map([[textNode, [MATCH]]]),
		translations: translation === undefined ? {} : { word: translation },
	});
}

function countInjectedWrappers(block: Element): number {
	return Array.from(block.childNodes).filter(
		(node) =>
			node instanceof HTMLSpanElement &&
			node.getAttribute(INJECTED_ATTRIBUTE) === "1",
	).length;
}

describe("renderAnnotations", () => {
	it("wraps annotated text and stores metadata when a translation exists", () => {
		const { block, textNode } = createBlockWithText("word");

		renderWord(block, textNode, "释义");

		expect(block.textContent).toBe("word(释义)");
		expect(block.childNodes).toHaveLength(1);
		expect(countInjectedWrappers(block)).toBe(1);

		const wrapperNode = block.firstChild;
		assert.instanceOf(wrapperNode, HTMLSpanElement);

		expect(wrapperNode.dataset["wbLemma"]).toBe("word");
		expect(wrapperNode.textContent).toBe("word(释义)");
		expect(wrapperNode.childNodes).toHaveLength(1);
	});

	it("keeps the original text when the translation is missing", () => {
		const { block, textNode } = createBlockWithText("word");

		renderWord(block, textNode, undefined);

		expect(block.textContent).toBe("word");
		expect(block.childNodes).toHaveLength(1);
		expect(countInjectedWrappers(block)).toBe(0);
	});
});
