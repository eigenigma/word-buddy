export function mountMarkup(markup: string): HTMLElement {
	const root = document.createElement("div");
	root.innerHTML = markup;
	document.body.append(root);
	return root;
}

export function mountBlock(markup: string): HTMLElement {
	const block = mountMarkup(markup).firstElementChild;
	if (!(block instanceof HTMLElement)) {
		throw new Error("Markup has no block element.");
	}
	return block;
}

export function textAt(root: Element, selector: string, childIndex = 0): Text {
	const node = root.querySelector(selector)?.childNodes[childIndex];
	if (!(node instanceof Text)) {
		throw new Error(`No text node at ${selector} child ${childIndex}.`);
	}
	return node;
}

export function rangeOf(
	start: readonly [Node, number],
	end: readonly [Node, number],
): Range {
	const range = document.createRange();
	range.setStart(...start);
	range.setEnd(...end);
	return range;
}
