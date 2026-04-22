import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { AhoCorasickMatch } from "../../shared/matching";
import { renderAnnotations } from "./renderer";

class FakeNode {
	parentNode: FakeElement | null = null;

	replaceWith(node: FakeDocumentFragment): void {
		if (this.parentNode === null) {
			return;
		}

		const index = this.parentNode.childNodes.indexOf(this);
		if (index < 0) {
			return;
		}

		this.parentNode.childNodes.splice(index, 1, ...node.consume());
		this.parentNode.relinkChildren();
		this.parentNode = null;
	}

	get textContent(): string {
		throw new Error("textContent getter must be implemented by subclasses");
	}

	set textContent(_value: string) {
		throw new Error("textContent setter must be implemented by subclasses");
	}
}

class FakeText extends FakeNode {
	constructor(
		readonly ownerDocument: FakeDocument,
		public data: string,
	) {
		super();
	}

	override get textContent(): string {
		return this.data;
	}

	override set textContent(value: string) {
		this.data = value;
	}
}

class FakeElement extends FakeNode {
	readonly childNodes: FakeNode[] = [];
	readonly dataset: Record<string, string> = {};

	constructor(
		readonly ownerDocument: FakeDocument,
		readonly tagName: string,
	) {
		super();
	}

	append(...nodes: FakeNode[]): void {
		for (const node of nodes) {
			node.parentNode = this;
			this.childNodes.push(node);
		}
	}

	relinkChildren(): void {
		for (const child of this.childNodes) {
			child.parentNode = this;
		}
	}

	override get textContent(): string {
		return this.childNodes.map((child) => child.textContent).join("");
	}

	override set textContent(value: string) {
		this.childNodes.length = 0;
		if (value.length > 0) {
			this.append(this.ownerDocument.createTextNode(value));
		}
	}
}

class FakeHTMLSpanElement extends FakeElement {
	constructor(ownerDocument: FakeDocument) {
		super(ownerDocument, "SPAN");
	}
}

class FakeDocumentFragment {
	private readonly childNodes: FakeNode[] = [];

	constructor(private readonly ownerDocument: FakeDocument) {}

	append(...items: Array<FakeNode | string>): void {
		for (const item of items) {
			if (typeof item === "string") {
				this.childNodes.push(this.ownerDocument.createTextNode(item));
				continue;
			}

			this.childNodes.push(item);
		}
	}

	consume(): FakeNode[] {
		const nodes = [...this.childNodes];
		this.childNodes.length = 0;
		return nodes;
	}
}

class FakeDocument {
	createDocumentFragment(): FakeDocumentFragment {
		return new FakeDocumentFragment(this);
	}

	createElement(tagName: string): FakeElement {
		if (tagName.toLowerCase() === "span") {
			return new FakeHTMLSpanElement(this);
		}

		return new FakeElement(this, tagName.toUpperCase());
	}

	createTextNode(text: string): FakeText {
		return new FakeText(this, text);
	}
}

const MATCH: AhoCorasickMatch = {
	end: 4,
	lemma: "word",
	start: 0,
	surface: "word",
};

function renderWord(
	block: FakeElement,
	textNode: FakeText,
	translation: string | undefined,
): void {
	renderAnnotations({
		block: block as unknown as Element,
		matchesByNode: new Map([[textNode as unknown as Text, [MATCH]]]),
		translations: translation === undefined ? {} : { word: translation },
	});
}

function countInjectedWrappers(block: FakeElement): number {
	return block.childNodes.filter(
		(node) =>
			node instanceof FakeHTMLSpanElement && node.dataset["wbInjected"] === "1",
	).length;
}

const hadHtmlSpanElement: boolean = "HTMLSpanElement" in globalThis;
const originalHtmlSpanElement: typeof HTMLSpanElement | undefined =
	globalThis.HTMLSpanElement;

beforeAll(() => {
	globalThis.HTMLSpanElement =
		FakeHTMLSpanElement as unknown as typeof HTMLSpanElement;
});

afterAll(() => {
	if (hadHtmlSpanElement) {
		globalThis.HTMLSpanElement = originalHtmlSpanElement;
		return;
	}

	Reflect.deleteProperty(globalThis, "HTMLSpanElement");
});

describe("renderAnnotations", () => {
	it("wraps annotated text and stores metadata when a translation exists", () => {
		const documentRef = new FakeDocument();
		const block = documentRef.createElement("p");
		const textNode = documentRef.createTextNode("word");
		block.append(textNode);

		renderWord(block, textNode, "释义");

		expect(block.textContent).toBe("word(释义)");
		expect(block.childNodes).toHaveLength(1);
		expect(countInjectedWrappers(block)).toBe(1);

		const wrapperNode = block.childNodes[0];
		expect(wrapperNode).toBeDefined();
		expect(wrapperNode).toBeInstanceOf(FakeHTMLSpanElement);
		if (!(wrapperNode instanceof FakeHTMLSpanElement)) {
			throw new Error("wrapper span missing after render");
		}

		expect(wrapperNode.dataset["wbLemma"]).toBe("word");
		expect(wrapperNode.textContent).toBe("word(释义)");
		expect(wrapperNode.childNodes).toHaveLength(1);
	});

	it("keeps the original text when the translation is missing", () => {
		const documentRef = new FakeDocument();
		const block = documentRef.createElement("p");
		const textNode = documentRef.createTextNode("word");
		block.append(textNode);

		renderWord(block, textNode, undefined);

		expect(block.textContent).toBe("word");
		expect(block.childNodes).toHaveLength(1);
		expect(countInjectedWrappers(block)).toBe(0);
	});
});
