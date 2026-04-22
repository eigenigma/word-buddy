import { BLOCK_SELECTOR } from "./skipPredicate";

const MUTATION_DEBOUNCE_MS = 250;

export interface MutationObserverController {
	readonly start: (root: Element) => void;
	readonly stop: () => void;
}

export interface MutationObserverControllerDependencies {
	readonly isRelevantBlock: (element: Element) => boolean;
	readonly scheduleBlockAnnotate: (block: HTMLElement) => void;
	readonly windowRef: Window;
}

function isHTMLElementBlock(element: Element): element is HTMLElement {
	return element instanceof HTMLElement;
}

function collectBlocksFromElement(
	element: Element,
	blocks: Set<HTMLElement>,
): void {
	if (element.matches(BLOCK_SELECTOR) && isHTMLElementBlock(element)) {
		blocks.add(element);
	}

	const closestBlock = element.closest(BLOCK_SELECTOR);
	if (closestBlock && isHTMLElementBlock(closestBlock)) {
		blocks.add(closestBlock);
	}

	for (const descendant of element.querySelectorAll(BLOCK_SELECTOR)) {
		if (isHTMLElementBlock(descendant)) {
			blocks.add(descendant);
		}
	}
}

function getElementForNode(node: Node): Element | null {
	if (node instanceof Element) {
		return node;
	}

	return node.parentElement;
}

function collectCandidateBlocks(nodes: Iterable<Node>): Set<HTMLElement> {
	const blocks = new Set<HTMLElement>();

	for (const node of nodes) {
		const element = getElementForNode(node);
		if (!element) {
			continue;
		}

		collectBlocksFromElement(element, blocks);
	}

	return blocks;
}

export function createMutationObserverController(
	dependencies: MutationObserverControllerDependencies,
): MutationObserverController {
	let mutationObserver: MutationObserver | null = null;
	let timerId: number | null = null;
	const bufferedNodes = new Set<Node>();

	const flush = (): void => {
		timerId = null;
		const candidateBlocks = collectCandidateBlocks(bufferedNodes);
		bufferedNodes.clear();

		for (const block of candidateBlocks) {
			if (!dependencies.isRelevantBlock(block)) {
				continue;
			}

			dependencies.scheduleBlockAnnotate(block);
		}
	};

	const scheduleFlush = (): void => {
		if (timerId !== null) {
			dependencies.windowRef.clearTimeout(timerId);
		}

		timerId = dependencies.windowRef.setTimeout(flush, MUTATION_DEBOUNCE_MS);
	};

	return {
		start: (root: Element): void => {
			mutationObserver = new MutationObserver((records): void => {
				for (const record of records) {
					bufferedNodes.add(record.target);
					for (const node of record.addedNodes) {
						bufferedNodes.add(node);
					}
				}

				scheduleFlush();
			});
			mutationObserver.observe(root, {
				attributes: false,
				characterData: false,
				childList: true,
				subtree: true,
			});
		},
		stop: (): void => {
			if (timerId !== null) {
				dependencies.windowRef.clearTimeout(timerId);
				timerId = null;
			}

			bufferedNodes.clear();
			mutationObserver?.disconnect();
			mutationObserver = null;
		},
	};
}
