import type {
	TranslateParagraphInput,
	TranslationMap,
} from "@/shared/llm/types";
import {
	type AhoCorasickMatch,
	type AhoCorasickMatcher,
	isWholeWordMatch,
} from "@/shared/matching/ahoCorasick";
import { collectBlockTextNodes, readBlockSourceText } from "./domWalker";
import { renderAnnotations, type TextReplacement } from "./renderer";
import { BLOCK_SELECTOR, isInSkippedSubtree } from "./skipPredicate";

export type TranslateBlock = (
	input: TranslateParagraphInput,
) => Promise<TranslationMap>;

export interface AnnotateBlockDependencies {
	// False once the block, the matcher or the runtime has moved on.
	readonly isCurrent: () => boolean;
	readonly onReplace: (replacement: TextReplacement) => void;
	readonly translate: TranslateBlock;
}

interface BlockMatchCollection {
	readonly lemmas: readonly string[];
	readonly matchesByNode: ReadonlyMap<Text, readonly AhoCorasickMatch[]>;
}

export function isRelevantBlock(element: Element): element is HTMLElement {
	return element instanceof HTMLElement && !isInSkippedSubtree(element);
}

export function findCandidateBlocks(
	documentRef: Document,
): readonly HTMLElement[] {
	return Array.from(documentRef.querySelectorAll(BLOCK_SELECTOR)).filter(
		isRelevantBlock,
	);
}

function collectBlockMatches(
	block: HTMLElement,
	matcher: AhoCorasickMatcher,
): BlockMatchCollection {
	const textNodes = collectBlockTextNodes(block);
	const matchesByNode = new Map<Text, readonly AhoCorasickMatch[]>();
	const lemmas = new Set<string>();

	for (const textNode of textNodes) {
		const matches = matcher
			.findAll(textNode.data)
			.filter((match) =>
				isWholeWordMatch(textNode.data, match.start, match.end),
			);
		if (matches.length === 0) {
			continue;
		}

		matchesByNode.set(textNode, matches);
		for (const match of matches) {
			lemmas.add(match.lemma);
		}
	}

	return {
		lemmas: Array.from(lemmas).sort(),
		matchesByNode: matchesByNode,
	};
}

// The page may have made a text node editable while its translation was
// pending.
function keepAnnotatableNodes(
	matchesByNode: ReadonlyMap<Text, readonly AhoCorasickMatch[]>,
): ReadonlyMap<Text, readonly AhoCorasickMatch[]> {
	return new Map(
		Array.from(matchesByNode).filter(([textNode]) => {
			const parent = textNode.parentElement;
			return parent !== null && !isInSkippedSubtree(parent);
		}),
	);
}

export async function annotateBlock(
	block: HTMLElement,
	matcher: AhoCorasickMatcher | null,
	dependencies: AnnotateBlockDependencies,
): Promise<void> {
	if (matcher === null) {
		return;
	}

	const { lemmas, matchesByNode } = collectBlockMatches(block, matcher);
	if (matchesByNode.size === 0) {
		return;
	}

	const translations = await dependencies.translate({
		paragraph: readBlockSourceText(block),
		words: lemmas,
	});
	if (!dependencies.isCurrent()) {
		return;
	}

	renderAnnotations({
		matchesByNode: keepAnnotatableNodes(matchesByNode),
		onReplace: dependencies.onReplace,
		translations: translations,
	});
}
