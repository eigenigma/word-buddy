export function resolveElement(node: Node): Element | null {
	if (node instanceof Element) {
		return node;
	}

	return node.parentElement;
}

export function readComputedStyle(element: Element): CSSStyleDeclaration {
	const view = element.ownerDocument.defaultView;
	if (view === null) {
		throw new Error("An element outside a window has no computed style.");
	}

	return view.getComputedStyle(element);
}
