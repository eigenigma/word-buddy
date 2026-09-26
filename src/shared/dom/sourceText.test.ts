// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { mountMarkup, rangeOf, textAt } from "@/test-helpers/dom";

import { createGlossSpan, INJECTED_SELECTOR } from "./injectedMarker";
import {
	readRangeSourceText,
	readSourceText,
	type Separator,
	type SourceTextPolicy,
	type TextBoundary,
} from "./sourceText";

function boundaryByTag(element: Element): TextBoundary {
	if (element.matches("td, th")) {
		return "\t";
	}

	return element.matches("div, p, table, tbody, tr") ? "\n" : "";
}

const INCLUDE_ALL: SourceTextPolicy = {
	boundaryAround: boundaryByTag,
	isPruned: (): boolean => false,
	isTextIncluded: (): boolean => true,
	separatorForPruned: (): Separator => "",
};

function gloss(word: string, translation: string): string {
	return createGlossSpan(document, {
		gloss: translation,
		lemma: word.toLowerCase(),
		word: word,
	}).outerHTML;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("readSourceText", () => {
	it("reads each gloss span as its word, however often it repeats", () => {
		const root = mountMarkup(
			`<p>I ${gloss("run", "跑")} and ${gloss("run", "跑")} daily.</p>`,
		);

		expect(readSourceText(root, INCLUDE_ALL)).toBe("I run and run daily.");
	});

	it("keeps author-written word(gloss) text", () => {
		const root = mountMarkup("<p>run(跑) is plain text</p>");

		expect(readSourceText(root, INCLUDE_ALL)).toBe("run(跑) is plain text");
	});

	it("joins text across inline markup without a break", () => {
		const root = mountMarkup("<p>hel<em>lo</em> world</p>");

		expect(readSourceText(root, INCLUDE_ALL)).toBe("hello world");
	});

	it("collapses whitespace as normal flow does", () => {
		const root = mountMarkup(
			"<p>\n\t  The cat\n   sat <em> down </em> .\n</p>",
		);

		expect(readSourceText(root, INCLUDE_ALL)).toBe("The cat sat down .");
	});

	it("breaks lines at br and at block boundaries", () => {
		const root = mountMarkup(
			"<p>one<br>two</p>\n  <div><div>three</div></div>four",
		);

		expect(readSourceText(root, INCLUDE_ALL)).toBe("one\ntwo\nthree\nfour");
	});

	it("separates cells by tabs and rows by newlines", () => {
		const root = mountMarkup(
			"<table><tr><td>a</td> <th>b</th></tr><tr><td>c</td><td>d</td></tr></table>",
		);

		expect(readSourceText(root, INCLUDE_ALL)).toBe("a\tb\nc\td");
	});

	it("takes every boundary but br's from the policy", () => {
		const root = mountMarkup(
			'<div>hel<div class="inline">lo</div><br><span class="block">ice</span><span class="block">cream</span></div>',
		);
		const policy: SourceTextPolicy = {
			...INCLUDE_ALL,
			boundaryAround: (element: Element): "" | "\n" =>
				element.matches(".block") ? "\n" : "",
		};

		expect(readSourceText(root, policy)).toBe("hello\nice\ncream");
	});

	it("leaves only the policy's separator where it prunes, even at a br", () => {
		const root = mountMarkup(
			"<p>Use<code>map</code>here<br>now<em>x</em>on</p>",
		);
		const policy: SourceTextPolicy = {
			...INCLUDE_ALL,
			isPruned: (element: Element): boolean => element.matches("code, br, em"),
			separatorForPruned: (element: Element): Separator =>
				element.matches("code") ? "\t" : "",
		};

		expect(readSourceText(root, policy)).toBe("Use\therenowon");
	});

	it("leaves out text the policy excludes", () => {
		const root = mountMarkup("<p>shown <span>hidden</span> too</p>");
		const hidden = textAt(root, "span");
		const policy: SourceTextPolicy = {
			...INCLUDE_ALL,
			isTextIncluded: (text: Text): boolean => text !== hidden,
		};

		expect(readSourceText(root, policy)).toBe("shown too");
	});

	it("drops anything a page adds to a gloss span besides the word", () => {
		const root = mountMarkup(`<p>${gloss("run", "跑")}</p>`);
		root.querySelector(INJECTED_SELECTOR)?.append(" extra");

		expect(readSourceText(root, INCLUDE_ALL)).toBe("run");
	});
});

describe("readRangeSourceText", () => {
	const markup = `<p>The ${gloss("Running", "跑")} dog barks.</p>`;

	it("keeps a range inside the word part in source case", () => {
		const root = mountMarkup(markup);
		const glossText = textAt(root, INJECTED_SELECTOR);

		expect(
			readRangeSourceText(rangeOf([glossText, 0], [glossText, 4]), INCLUDE_ALL),
		).toBe("Runn");
	});

	it("reads nothing from a range inside the gloss part", () => {
		const root = mountMarkup(markup);
		const glossText = textAt(root, INJECTED_SELECTOR);

		expect(
			readRangeSourceText(rangeOf([glossText, 8], [glossText, 9]), INCLUDE_ALL),
		).toBe("");
	});

	it("clips a range across both parts to the word part", () => {
		const root = mountMarkup(markup);
		const glossText = textAt(root, INJECTED_SELECTOR);

		expect(
			readRangeSourceText(
				rangeOf([glossText, 3], [glossText, 10]),
				INCLUDE_ALL,
			),
		).toBe("ning");
	});

	it("reads the word of a gloss span a range crosses", () => {
		const root = mountMarkup(markup);
		const before = textAt(root, "p");
		const after = textAt(root, "p", 2);

		expect(
			readRangeSourceText(rangeOf([before, 1], [after, 4]), INCLUDE_ALL),
		).toBe("he Running dog");
	});

	it("starts after the gloss when a range begins inside it", () => {
		const root = mountMarkup(markup);
		const glossText = textAt(root, INJECTED_SELECTOR);
		const after = textAt(root, "p", 2);

		expect(
			readRangeSourceText(rangeOf([glossText, 9], [after, 4]), INCLUDE_ALL),
		).toBe("dog");
	});

	it("applies the same boundaries and policy as whole-element reads", () => {
		const root = mountMarkup("<p>first <em>one</em></p><p>second</p>");
		const range = document.createRange();
		range.selectNodeContents(root);

		expect(readRangeSourceText(range, INCLUDE_ALL)).toBe(
			readSourceText(root, INCLUDE_ALL),
		);
		expect(readRangeSourceText(range, INCLUDE_ALL)).toBe("first one\nsecond");
	});
});
