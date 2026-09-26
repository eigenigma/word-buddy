import {
	readSourceText,
	type Separator,
	type SourceTextPolicy,
	type TextBoundary,
} from "@/shared/dom/sourceText";

import {
	isInSkippedSubtree,
	isPrunedFromMatching,
	isPrunedFromParagraph,
} from "./skipPredicate";

const CELL_ELEMENTS = new Set(["td", "th"]);
const LINE_ELEMENTS = new Set([
	"address",
	"article",
	"aside",
	"blockquote",
	"caption",
	"dd",
	"details",
	"dialog",
	"div",
	"dl",
	"dt",
	"fieldset",
	"figcaption",
	"figure",
	"footer",
	"form",
	"h1",
	"h2",
	"h3",
	"h4",
	"h5",
	"h6",
	"header",
	"hgroup",
	"hr",
	"legend",
	"li",
	"main",
	"menu",
	"nav",
	"ol",
	"p",
	"pre",
	"section",
	"summary",
	"table",
	"tbody",
	"tfoot",
	"thead",
	"tr",
	"ul",
]);

function readTagBoundary(element: Element): TextBoundary {
	if (CELL_ELEMENTS.has(element.localName)) {
		return "\t";
	}

	return LINE_ELEMENTS.has(element.localName) ? "\n" : "";
}

function separateAroundPruned(element: Element): Separator {
	const boundary = readTagBoundary(element);
	return boundary === "" ? " " : boundary;
}

// The annotator matches raw text without reading styles, so its paragraph
// takes boundaries from tag names and ignores visibility. Unable to tell
// whether pruned content renders, it keeps the words on either side apart
// rather than join them into one.
const BLOCK_TEXT_POLICY: SourceTextPolicy = {
	boundaryAround: readTagBoundary,
	isPruned: isPrunedFromParagraph,
	isTextIncluded: (): boolean => true,
	separatorForPruned: separateAroundPruned,
};

function acceptBlockNode(node: Node): number {
	if (node instanceof Text) {
		return node.data.length === 0
			? NodeFilter.FILTER_REJECT
			: NodeFilter.FILTER_ACCEPT;
	}

	// Rejecting an element prunes its whole subtree; skipping only hides the
	// element itself.
	return node instanceof Element && isPrunedFromMatching(node)
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

export function readBlockSourceText(block: Element): string {
	return readSourceText(block, BLOCK_TEXT_POLICY);
}
