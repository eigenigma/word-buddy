import { isSkippedElement } from "./skipPredicate";

export interface DomTextCollection {
	readonly paragraphText: string;
	readonly textNodes: readonly Text[];
}

function shouldRejectTextNode(textNode: Text, block: Element): boolean {
	if (textNode.data.length === 0) {
		return true;
	}

	let currentElement = textNode.parentElement;
	while (currentElement) {
		if (currentElement.closest("[data-wb-injected]")) {
			return true;
		}

		if (isSkippedElement(currentElement)) {
			return true;
		}

		if (currentElement === block) {
			break;
		}

		currentElement = currentElement.parentElement;
	}

	return false;
}

export function collectBlockTextNodes(block: Element): DomTextCollection {
	if (isSkippedElement(block) || block.closest("[data-wb-injected]")) {
		return {
			paragraphText: "",
			textNodes: [],
		};
	}

	const documentRef = block.ownerDocument;
	const textNodes: Text[] = [];
	const treeWalker = documentRef.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
		acceptNode: (node: Node): number => {
			if (!(node instanceof Text)) {
				return NodeFilter.FILTER_REJECT;
			}

			return shouldRejectTextNode(node, block)
				? NodeFilter.FILTER_REJECT
				: NodeFilter.FILTER_ACCEPT;
		},
	});

	let currentNode = treeWalker.nextNode();
	while (currentNode) {
		if (currentNode instanceof Text) {
			textNodes.push(currentNode);
		}
		currentNode = treeWalker.nextNode();
	}

	return {
		paragraphText: block.textContent?.trim() ?? "",
		textNodes: textNodes,
	};
}
