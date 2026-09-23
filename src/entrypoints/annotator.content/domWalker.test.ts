// @vitest-environment jsdom
import { describe, expect, it } from "vitest";

import { collectBlockTextNodes } from "./domWalker";

describe("collectBlockTextNodes", () => {
	it("returns no text nodes for blocks inside injected annotations", () => {
		const wrapper = document.createElement("span");
		wrapper.dataset["wbInjected"] = "1";
		const block = document.createElement("p");
		block.textContent = "word";
		wrapper.append(block);

		expect(collectBlockTextNodes(block)).toEqual([]);
	});
});
