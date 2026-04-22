import { describe, expect, it } from "vitest";

import {
	buildParagraphBatches,
	collectWalkableTextNodes,
	createAhoCorasickMatcher,
	DEFAULT_WALKER_CONFIG,
	type WalkableNode,
} from "../../shared/matching";

function text(textContent: string): WalkableNode {
	return {
		children: [],
		kind: "text",
		textContent: textContent,
	};
}

function element(
	tagName: string,
	children: readonly WalkableNode[],
	attributes?: Readonly<Record<string, string>>,
): WalkableNode {
	return {
		...(attributes === undefined ? {} : { attributes: attributes }),
		children: children,
		kind: "element",
		tagName: tagName,
	};
}

function summarizeBatches(
	batches: ReturnType<typeof buildParagraphBatches>,
): readonly string[] {
	return batches.map(
		(batch) =>
			`${batch.paragraphKey}:${batch.matches.map((match) => `${match.surface}@${match.start}-${match.end}`).join(",")}`,
	);
}

function buildSyntheticTree(): WalkableNode {
	return element("div", [
		element("p", [
			text("The cat sat. "),
			element("span", [text("agenda time.")]),
		]),
		element("p", [text("We concatenate strings here.")]),
		element("div", [text("editable cat agenda")], { contenteditable: "true" }),
		element("code", [text("code cat agenda")]),
		element("div", [text("annotated cat agenda")], { "data-wb-injected": "1" }),
		element("li", [text("Another cat appears.")]),
	]);
}

describe("annotator pipeline smoke checks", () => {
	it("collects walkable text nodes with the expected paragraph grouping", () => {
		const textNodes = collectWalkableTextNodes(
			buildSyntheticTree(),
			DEFAULT_WALKER_CONFIG,
		);

		expect(textNodes).toHaveLength(4);
		expect(textNodes.map((node) => node.text)).toStrictEqual([
			"The cat sat. ",
			"agenda time.",
			"We concatenate strings here.",
			"Another cat appears.",
		]);
		expect(textNodes.map((node) => node.paragraphKey)).toStrictEqual([
			"div#0/p#0",
			"div#0/p#0",
			"div#0/p#1",
			"div#0/li#5",
		]);
		expect(textNodes[0]?.paragraphText).toBe("The cat sat. agenda time.");
		expect(textNodes[1]?.paragraphText).toBe("The cat sat. agenda time.");
		expect(textNodes.some((node) => node.text.includes("editable"))).toBe(
			false,
		);
		expect(textNodes.some((node) => node.text.includes("code cat"))).toBe(
			false,
		);
		expect(textNodes.some((node) => node.text.includes("annotated cat"))).toBe(
			false,
		);
	});

	it("builds paragraph batches with text-node-relative offsets only for whole words", () => {
		const textNodes = collectWalkableTextNodes(
			buildSyntheticTree(),
			DEFAULT_WALKER_CONFIG,
		);
		const matcher = createAhoCorasickMatcher([
			{ lemma: "cat", surface: "cat" },
			{ lemma: "agenda", surface: "agenda" },
		]);
		const batches = buildParagraphBatches(matcher, textNodes);

		expect(batches).toHaveLength(2);
		expect(summarizeBatches(batches)).toStrictEqual([
			"div#0/p#0:cat@4-7,agenda@0-6",
			"div#0/li#5:cat@8-11",
		]);
		expect(batches[0]?.textNodes).toHaveLength(2);
		expect(batches[0]?.matches[1]?.start).toBe(0);
		expect(batches.every((batch) => batch.paragraphKey !== "div#0/p#1")).toBe(
			true,
		);
	});
});
