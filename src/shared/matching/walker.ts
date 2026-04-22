import type { WalkableNode, WalkableTextNode } from "./types";

export interface WalkerConfig {
	readonly blockTags: ReadonlySet<string>;
	readonly skipAttributes: ReadonlyMap<string, string>;
	readonly skipTags: ReadonlySet<string>;
}

interface TraversalFrame {
	readonly node: WalkableNode;
	readonly paragraphKey: string;
	readonly path: string;
}

interface PendingTextNode {
	readonly node: WalkableNode;
	readonly paragraphKey: string;
	readonly text: string;
}

export const DEFAULT_WALKER_CONFIG: WalkerConfig = {
	blockTags: new Set<string>([
		"p",
		"div",
		"li",
		"td",
		"th",
		"blockquote",
		"article",
		"section",
		"figcaption",
		"summary",
		"dt",
		"dd",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
	]),
	skipAttributes: new Map<string, string>([
		["contenteditable", "true"],
		["data-wb-injected", ""],
	]),
	skipTags: new Set<string>([
		"script",
		"style",
		"code",
		"pre",
		"input",
		"textarea",
		"noscript",
		"svg",
		"math",
		"iframe",
		"template",
	]),
};

function normalizeTagName(node: WalkableNode): string {
	return node.tagName?.toLowerCase() ?? "element";
}

function getNodeText(node: WalkableNode): string {
	return node.textContent ?? "";
}

function getRootPath(root: WalkableNode): string {
	if (root.kind === "element") {
		return `${normalizeTagName(root)}#0`;
	}

	return "root#0";
}

function hasSkippedAttribute(
	attributes: Readonly<Record<string, string>> | undefined,
	config: WalkerConfig,
): boolean {
	if (!attributes) {
		return false;
	}

	for (const [attributeName, expectedValue] of config.skipAttributes) {
		const actualValue = attributes[attributeName];
		if (actualValue === undefined) {
			continue;
		}

		if (expectedValue === "" || actualValue === expectedValue) {
			return true;
		}
	}

	return false;
}

function shouldSkipSubtree(node: WalkableNode, config: WalkerConfig): boolean {
	if (node.kind !== "element") {
		return false;
	}

	return (
		config.skipTags.has(normalizeTagName(node)) ||
		hasSkippedAttribute(node.attributes, config)
	);
}

function createChildFrames(
	frame: TraversalFrame,
	config: WalkerConfig,
): readonly TraversalFrame[] {
	const childFrames: TraversalFrame[] = [];
	let elementIndex = 0;

	for (const child of frame.node.children) {
		if (child.kind === "element") {
			const tagName = normalizeTagName(child);
			const childPath = `${frame.path}/${tagName}#${elementIndex}`;
			childFrames.push({
				node: child,
				paragraphKey: config.blockTags.has(tagName)
					? childPath
					: frame.paragraphKey,
				path: childPath,
			});
			elementIndex += 1;
			continue;
		}

		childFrames.push({
			node: child,
			paragraphKey: frame.paragraphKey,
			path: frame.path,
		});
	}

	return childFrames;
}

function appendParagraphFragment(
	paragraphFragments: Map<string, string[]>,
	paragraphKey: string,
	text: string,
): void {
	const fragments = paragraphFragments.get(paragraphKey);
	if (fragments) {
		fragments.push(text);
		return;
	}

	paragraphFragments.set(paragraphKey, [text]);
}

function collectTextNode(
	frame: TraversalFrame,
	pendingTextNodes: PendingTextNode[],
	paragraphFragments: Map<string, string[]>,
): void {
	const text = getNodeText(frame.node);
	if (text.length === 0) {
		return;
	}

	pendingTextNodes.push({
		node: frame.node,
		paragraphKey: frame.paragraphKey,
		text: text,
	});
	appendParagraphFragment(paragraphFragments, frame.paragraphKey, text);
}

function pushChildFrames(
	stack: TraversalFrame[],
	frame: TraversalFrame,
	config: WalkerConfig,
): void {
	const childFrames = createChildFrames(frame, config);
	for (let index = childFrames.length - 1; index >= 0; index -= 1) {
		const childFrame = childFrames[index];
		if (childFrame) {
			stack.push(childFrame);
		}
	}
}

export function collectWalkableTextNodes(
	root: WalkableNode,
	config: WalkerConfig,
): readonly WalkableTextNode[] {
	const rootPath = getRootPath(root);
	const stack: TraversalFrame[] = [
		{
			node: root,
			paragraphKey: rootPath,
			path: rootPath,
		},
	];
	const pendingTextNodes: PendingTextNode[] = [];
	const paragraphFragments = new Map<string, string[]>();

	while (stack.length > 0) {
		const frame = stack.pop();
		if (!frame) {
			continue;
		}

		if (frame.node.kind === "text") {
			collectTextNode(frame, pendingTextNodes, paragraphFragments);
			continue;
		}

		if (shouldSkipSubtree(frame.node, config)) {
			continue;
		}

		pushChildFrames(stack, frame, config);
	}

	return pendingTextNodes.map((textNode) => ({
		node: textNode.node,
		paragraphKey: textNode.paragraphKey,
		paragraphText:
			paragraphFragments.get(textNode.paragraphKey)?.join("") ?? "",
		text: textNode.text,
	}));
}
