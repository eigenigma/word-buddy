import {
	type AhoCorasickMatch,
	type AhoCorasickMatcher,
	isWholeWordMatch,
} from "./ahoCorasick";
import type { WalkableTextNode } from "./types";

export interface ParagraphBatch {
	readonly matches: readonly AhoCorasickMatch[];
	readonly paragraphKey: string;
	readonly paragraphText: string;
	readonly textNodes: readonly WalkableTextNode[];
}

interface MutableParagraphBatch {
	readonly matches: AhoCorasickMatch[];
	readonly paragraphKey: string;
	readonly paragraphText: string;
	readonly textNodes: WalkableTextNode[];
}

interface ParagraphBatchState {
	readonly batch: MutableParagraphBatch;
	readonly dedupeKeys: Set<string>;
}

function createBatch(textNode: WalkableTextNode): MutableParagraphBatch {
	return {
		matches: [],
		paragraphKey: textNode.paragraphKey,
		paragraphText: textNode.paragraphText,
		textNodes: [],
	};
}

function createParagraphBatchState(
	textNode: WalkableTextNode,
): ParagraphBatchState {
	return {
		batch: createBatch(textNode),
		dedupeKeys: new Set<string>(),
	};
}

function getOrCreateParagraphBatchState(
	paragraphStates: Map<string, ParagraphBatchState>,
	textNode: WalkableTextNode,
): ParagraphBatchState {
	const existingParagraphState = paragraphStates.get(textNode.paragraphKey);
	if (existingParagraphState) {
		return existingParagraphState;
	}

	const paragraphState = createParagraphBatchState(textNode);
	paragraphStates.set(textNode.paragraphKey, paragraphState);
	return paragraphState;
}

function appendMatches(
	batch: MutableParagraphBatch,
	dedupeKeys: Set<string>,
	textNodeIndex: number,
	rawMatches: readonly AhoCorasickMatch[],
	text: string,
): void {
	for (const match of rawMatches) {
		if (!isWholeWordMatch(text, match.start, match.end)) {
			continue;
		}

		const dedupeKey = `${textNodeIndex}\u001f${match.lemma}\u001f${match.start}\u001f${match.end}`;
		if (dedupeKeys.has(dedupeKey)) {
			continue;
		}

		dedupeKeys.add(dedupeKey);
		batch.matches.push(match);
	}
}

export function buildParagraphBatches(
	matcher: AhoCorasickMatcher,
	nodes: readonly WalkableTextNode[],
): readonly ParagraphBatch[] {
	const paragraphStates = new Map<string, ParagraphBatchState>();

	for (const textNode of nodes) {
		const paragraphState = getOrCreateParagraphBatchState(
			paragraphStates,
			textNode,
		);
		const textNodeIndex = paragraphState.batch.textNodes.length;
		paragraphState.batch.textNodes.push(textNode);
		appendMatches(
			paragraphState.batch,
			paragraphState.dedupeKeys,
			textNodeIndex,
			matcher.findAll(textNode.text),
			textNode.text,
		);
	}

	const paragraphBatches: ParagraphBatch[] = [];
	for (const paragraphState of paragraphStates.values()) {
		if (paragraphState.batch.matches.length === 0) {
			continue;
		}

		paragraphBatches.push({
			matches: paragraphState.batch.matches,
			paragraphKey: paragraphState.batch.paragraphKey,
			paragraphText: paragraphState.batch.paragraphText,
			textNodes: paragraphState.batch.textNodes,
		});
	}

	return paragraphBatches;
}
