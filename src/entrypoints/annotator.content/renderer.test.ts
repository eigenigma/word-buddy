// @vitest-environment jsdom
import { assert, describe, expect, it } from "vitest";

import {
	INJECTED_ATTRIBUTE,
	INJECTED_WORD_ATTRIBUTE,
} from "@/shared/dom/injectedMarker";
import type { AhoCorasickMatch } from "@/shared/matching/ahoCorasick";
import { renderAnnotations, type TextReplacement } from "./renderer";

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
	textNode: Text,
	translation: string | undefined,
): readonly TextReplacement[] {
	const replacements: TextReplacement[] = [];
	renderAnnotations({
		matchesByNode: new Map([[textNode, [MATCH]]]),
		onReplace: (replacement: TextReplacement): void => {
			replacements.push(replacement);
		},
		translations: translation === undefined ? {} : { word: translation },
	});
	return replacements;
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
		const { block, textNode } = createBlockWithText("Word");

		renderWord(textNode, "释义");

		expect(block.textContent).toBe("Word(释义)");
		expect(block.childNodes).toHaveLength(1);
		expect(countInjectedWrappers(block)).toBe(1);

		const wrapperNode = block.firstChild;
		assert.instanceOf(wrapperNode, HTMLSpanElement);

		expect(wrapperNode.dataset["wbLemma"]).toBe("word");
		expect(wrapperNode.getAttribute(INJECTED_WORD_ATTRIBUTE)).toBe("Word");
		expect(wrapperNode.textContent).toBe("Word(释义)");
		expect(wrapperNode.childNodes).toHaveLength(1);
	});

	it("keeps the original text when the translation is missing", () => {
		const { block, textNode } = createBlockWithText("word");

		const replacements = renderWord(textNode, undefined);

		expect(block.textContent).toBe("word");
		expect(block.firstChild).toBe(textNode);
		expect(countInjectedWrappers(block)).toBe(0);
		expect(replacements).toStrictEqual([]);
	});

	it("reports each replacement before making it", () => {
		const { block, textNode } = createBlockWithText("word here");
		const reports: {
			readonly parentWhenReported: ParentNode | null;
			readonly replacement: TextReplacement;
		}[] = [];

		renderAnnotations({
			matchesByNode: new Map([[textNode, [MATCH]]]),
			onReplace: (replacement: TextReplacement): void => {
				reports.push({
					parentWhenReported: replacement.removed.parentNode,
					replacement: replacement,
				});
			},
			translations: { word: "释义" },
		});

		expect(reports).toStrictEqual([
			{
				parentWhenReported: block,
				replacement: { added: Array.from(block.childNodes), removed: textNode },
			},
		]);
		expect(block.childNodes).toHaveLength(2);
	});

	it("leaves a text node the page has already detached", () => {
		const { block, textNode } = createBlockWithText("word");
		textNode.remove();

		const replacements = renderWord(textNode, "释义");

		expect(block.childNodes).toHaveLength(0);
		expect(replacements).toStrictEqual([]);
	});
});
