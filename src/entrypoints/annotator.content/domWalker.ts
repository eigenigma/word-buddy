import { isInSkippedSubtree, isSkippedElement } from "./skipPredicate";

function acceptBlockNode(node: Node): number {
	if (node instanceof Text) {
		return node.data.length === 0
			? NodeFilter.FILTER_REJECT
			: NodeFilter.FILTER_ACCEPT;
	}

	// Rejecting an element prunes its whole subtree; skipping only hides the
	// element itself.
	return node instanceof Element && isSkippedElement(node)
		? NodeFilter.FILTER_REJECT
		: NodeFilter.FILTER_SKIP;
}

export function collectBlockTextNodes(block: Element): readonly Text[] {
	if (isInSkippedSubtree(block)) {
		return [];
	}

	const treeWalker = block.ownerDocument.createTreeWalker(
		block,
		NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
		{ acceptNode: acceptBlockNode },
	);
	const textNodes: Text[] = [];

	let currentNode = treeWalker.nextNode();
	while (currentNode) {
		if (currentNode instanceof Text) {
			textNodes.push(currentNode);
		}
		currentNode = treeWalker.nextNode();
	}

	return textNodes;
}
