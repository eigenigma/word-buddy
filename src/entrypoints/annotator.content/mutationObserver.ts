import { resolveElement } from "@/shared/dom/element";
import type { Timers } from "@/shared/utils/timers";

import type { TextReplacement } from "./renderer";
import { BLOCK_SELECTOR } from "./skipPredicate";

const MUTATION_DEBOUNCE_MS = 250;

type ObservedMutations = Pick<MutationObserver, "disconnect" | "observe">;

export type CreateMutationObserver = (
	callback: MutationCallback,
) => ObservedMutations;

export interface MutationObserverController {
	// Registers a replacement the annotator is about to make, so its record is
	// not mistaken for a page change.
	readonly expectReplacement: (replacement: TextReplacement) => void;
	readonly start: (root: Element) => void;
	readonly stop: () => void;
}

export interface MutationObserverControllerDependencies {
	readonly createObserver: CreateMutationObserver;
	readonly isRelevantBlock: (element: Element) => element is HTMLElement;
	readonly onBlockChanged: (block: HTMLElement) => void;
	readonly timers: Timers;
}

// A changed child list changes the text of the block around it, and an added
// element brings the blocks within it; other blocks under a changed container
// keep their text.
function findChangedBlocks(
	changedParents: Iterable<Node>,
	addedElements: Iterable<Element>,
): ReadonlySet<Element> {
	const blocks = new Set<Element>();

	for (const parent of changedParents) {
		const block = resolveElement(parent)?.closest(BLOCK_SELECTOR);
		if (block) {
			blocks.add(block);
		}
	}
	for (const element of addedElements) {
		if (element.matches(BLOCK_SELECTOR)) {
			blocks.add(element);
		}
		for (const block of element.querySelectorAll(BLOCK_SELECTOR)) {
			blocks.add(block);
		}
	}

	return blocks;
}

function hasSameNodes(nodes: NodeList, expected: readonly Node[]): boolean {
	return (
		nodes.length === expected.length &&
		expected.every((node, index) => nodes.item(index) === node)
	);
}

function isExpectedReplacement(
	record: MutationRecord,
	expectedAdditions: ReadonlyMap<Node, readonly Node[]>,
): boolean {
	const removed =
		record.removedNodes.length === 1 ? record.removedNodes.item(0) : null;
	const added = removed === null ? undefined : expectedAdditions.get(removed);
	return added !== undefined && hasSameNodes(record.addedNodes, added);
}

export function createMutationObserverController(
	dependencies: MutationObserverControllerDependencies,
): MutationObserverController {
	let mutationObserver: ObservedMutations | null = null;
	let timerId: number | null = null;
	const changedParents = new Set<Node>();
	const addedElements = new Set<Element>();
	// Keyed by the text node each expected replacement removes.
	const expectedAdditions = new Map<Node, readonly Node[]>();

	const flush = (): void => {
		timerId = null;
		const changedBlocks = findChangedBlocks(changedParents, addedElements);
		changedParents.clear();
		addedElements.clear();

		for (const block of changedBlocks) {
			if (dependencies.isRelevantBlock(block)) {
				dependencies.onBlockChanged(block);
			}
		}
	};

	const scheduleFlush = (): void => {
		if (timerId !== null) {
			dependencies.timers.clearTimeout(timerId);
		}

		timerId = dependencies.timers.setTimeout(flush, MUTATION_DEBOUNCE_MS);
	};

	const onRecords = (records: readonly MutationRecord[]): void => {
		const pageRecords = records.filter(
			(record) => !isExpectedReplacement(record, expectedAdditions),
		);
		// Every expected replacement was made before this delivery, so one
		// whose record is not in it will never arrive.
		expectedAdditions.clear();

		// An added text node lies in the record's target, already buffered.
		for (const record of pageRecords) {
			changedParents.add(record.target);
			for (const node of record.addedNodes) {
				if (node instanceof Element) {
					addedElements.add(node);
				}
			}
		}
		if (pageRecords.length > 0) {
			scheduleFlush();
		}
	};

	return {
		expectReplacement: (replacement: TextReplacement): void => {
			if (mutationObserver !== null) {
				expectedAdditions.set(replacement.removed, replacement.added);
			}
		},
		start: (root: Element): void => {
			mutationObserver = dependencies.createObserver(onRecords);
			mutationObserver.observe(root, {
				attributes: false,
				characterData: false,
				childList: true,
				subtree: true,
			});
		},
		stop: (): void => {
			if (timerId !== null) {
				dependencies.timers.clearTimeout(timerId);
				timerId = null;
			}

			changedParents.clear();
			addedElements.clear();
			expectedAdditions.clear();
			mutationObserver?.disconnect();
			mutationObserver = null;
		},
	};
}
