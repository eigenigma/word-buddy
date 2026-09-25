// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { findCandidateBlocks } from "./core";
import { INJECTED_ATTRIBUTE } from "./injectedMarker";

function createParagraph(id: string): HTMLParagraphElement {
	const paragraph = document.createElement("p");
	paragraph.id = id;
	paragraph.textContent = "The cat sat.";
	return paragraph;
}

function wrapIn(
	tagName: string,
	child: Element,
	attributes: Readonly<Record<string, string>> = {},
): HTMLElement {
	const wrapper = document.createElement(tagName);
	for (const [name, value] of Object.entries(attributes)) {
		wrapper.setAttribute(name, value);
	}
	wrapper.append(child);
	return wrapper;
}

function findCandidateIds(): readonly string[] {
	return findCandidateBlocks(document).map((block) => block.id);
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("findCandidateBlocks", () => {
	it("keeps plain blocks, including ones nested in inline markup", () => {
		document.body.append(
			createParagraph("plain"),
			wrapIn("div", wrapIn("span", createParagraph("nested"))),
		);

		expect(findCandidateIds()).toStrictEqual(["plain", "nested"]);
	});

	it("drops blocks under any skipped ancestor, however far up", () => {
		document.body.append(
			wrapIn("div", wrapIn("div", createParagraph("in-editor")), {
				contenteditable: "true",
			}),
			wrapIn("pre", wrapIn("span", createParagraph("in-pre"))),
			wrapIn("span", wrapIn("span", createParagraph("in-gloss")), {
				[INJECTED_ATTRIBUTE]: "1",
			}),
			createParagraph("kept"),
		);

		expect(findCandidateIds()).toStrictEqual(["kept"]);
	});

	it("drops a block that carries the injected marker itself", () => {
		const marked = createParagraph("marked");
		marked.setAttribute(INJECTED_ATTRIBUTE, "1");
		document.body.append(marked, createParagraph("kept"));

		expect(findCandidateIds()).toStrictEqual(["kept"]);
	});
});
