// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	restoreCheckVisibility,
	stubCheckVisibility,
} from "@/test-helpers/checkVisibility";
import { mountMarkup } from "@/test-helpers/dom";

import { readSourceText } from "./sourceText";
import { VISIBLE_TEXT_POLICY } from "./visibleText";

beforeEach(() => {
	stubCheckVisibility((): boolean => true);
});

afterEach(() => {
	document.body.replaceChildren();
	restoreCheckVisibility();
});

describe("VISIBLE_TEXT_POLICY", () => {
	it("breaks lines where the computed display does, whatever the tag", () => {
		const root = mountMarkup(
			'<div>hel<div style="display: inline">lo</div> <span style="display: block">ice</span><span style="display: block">cream</span></div>',
		);

		expect(readSourceText(root, VISIBLE_TEXT_POLICY)).toBe("hello\nice\ncream");
	});

	it("separates table cells by tabs and rows by newlines", () => {
		const root = mountMarkup(
			"<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>",
		);

		expect(readSourceText(root, VISIBLE_TEXT_POLICY)).toBe("a\tb\nc\td");
	});

	it("leaves out display: none subtrees", () => {
		const root = mountMarkup(
			'<p>shown <span style="display: none">gone</span>too</p>',
		);

		expect(readSourceText(root, VISIBLE_TEXT_POLICY)).toBe("shown too");
	});

	it("keeps a word whole across a hidden element or br", () => {
		const root = mountMarkup(
			"<p>hel<span hidden>ignored</span>lo wor<br hidden>ld</p>",
		);

		expect(readSourceText(root, VISIBLE_TEXT_POLICY)).toBe("hello world");
	});

	it("keeps visible text under a visibility: hidden parent", () => {
		const root = mountMarkup(
			'<p style="visibility: hidden">hidden <span style="visibility: visible">shown</span></p>',
		);

		expect(readSourceText(root, VISIBLE_TEXT_POLICY)).toBe("shown");
	});

	it("checks text in a display: contents parent against the nearest boxed ancestor", () => {
		stubCheckVisibility(
			(element: Element): boolean => element.localName !== "span",
		);
		const root = mountMarkup(
			'<p>before <span style="display: contents">inside</span></p>',
		);

		expect(readSourceText(root, VISIBLE_TEXT_POLICY)).toBe("before inside");
	});

	it("leaves out text whose boxed ancestor is not rendered", () => {
		stubCheckVisibility(
			(element: Element): boolean => element.localName !== "p",
		);
		const root = mountMarkup(
			'<p>before <span style="display: contents">inside</span></p><div>kept</div>',
		);

		expect(readSourceText(root, VISIBLE_TEXT_POLICY)).toBe("kept");
	});
});
