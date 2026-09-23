import type { ContentScriptContext } from "wxt/utils/content-script-context";

import {
	type AhoCorasickMatch,
	type AhoCorasickMatcher,
	createAhoCorasickMatcher,
	isWholeWordMatch,
	type PatternRef,
} from "@/shared/matching";
import { requestExpandLemmas } from "@/shared/runtime/dictionaryClient";
import { requestTranslateParagraph } from "@/shared/runtime/llmClient";
import { requestWordbookList } from "@/shared/runtime/wordbookClient";
import { collectBlockTextNodes } from "./domWalker";
import { renderAnnotations } from "./renderer";
import { BLOCK_SELECTOR, isSkippedElement } from "./skipPredicate";

export interface MatcherState {
	matcher: AhoCorasickMatcher | null;
}

interface BlockMatchCollection {
	readonly lemmas: readonly string[];
	readonly matchesByNode: ReadonlyMap<Text, readonly AhoCorasickMatch[]>;
}

export function isRelevantBlock(element: Element): element is HTMLElement {
	if (
		!(element instanceof HTMLElement) ||
		element.closest("[data-wb-injected]")
	) {
		return false;
	}

	let currentElement: Element | null = element;
	while (currentElement) {
		if (isSkippedElement(currentElement)) {
			return false;
		}

		currentElement = currentElement.parentElement;
	}

	return true;
}

export function findCandidateBlocks(
	documentRef: Document,
): readonly HTMLElement[] {
	return Array.from(documentRef.querySelectorAll(BLOCK_SELECTOR)).filter(
		(block): block is HTMLElement => isRelevantBlock(block),
	);
}

function buildPatternRefs(
	lemmas: readonly string[],
	expansions: Readonly<Record<string, readonly string[]>>,
): readonly PatternRef[] {
	const patterns: PatternRef[] = [];
	const dedupeKeys = new Set<string>();

	for (const lemma of lemmas) {
		const surfaces = expansions[lemma] ?? [lemma];
		for (const surface of surfaces) {
			const dedupeKey = `${lemma}\u001f${surface.toLowerCase()}`;
			if (dedupeKeys.has(dedupeKey)) {
				continue;
			}

			dedupeKeys.add(dedupeKey);
			patterns.push({
				lemma: lemma,
				surface: surface,
			});
		}
	}

	return patterns;
}

function collectBlockMatches(
	block: HTMLElement,
	matcher: AhoCorasickMatcher,
): BlockMatchCollection {
	const { textNodes } = collectBlockTextNodes(block);
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

export async function buildMatcher(): Promise<AhoCorasickMatcher | null> {
	const { entries } = await requestWordbookList();
	if (entries.length === 0) {
		return null;
	}

	const lemmas = entries.map((entry) => entry.lemma);
	const { expansions } = await requestExpandLemmas(lemmas);
	const patterns = buildPatternRefs(lemmas, expansions);
	if (patterns.length === 0) {
		return null;
	}

	return createAhoCorasickMatcher(patterns);
}

export async function rebuildMatcherState(state: MatcherState): Promise<void> {
	state.matcher = await buildMatcher();
}

export async function annotateBlock(
	ctx: ContentScriptContext,
	block: HTMLElement,
	state: MatcherState,
	processedBlocks: WeakSet<HTMLElement>,
	onWarn: (message: string, error: unknown) => void,
): Promise<void> {
	const matcher = state.matcher;
	if (matcher === null) {
		return;
	}

	try {
		const { lemmas, matchesByNode } = collectBlockMatches(block, matcher);
		if (matchesByNode.size === 0) {
			return;
		}

		// biome-ignore lint/nursery/useDomNodeTextContent: the LLM must only see rendered text; textContent leaks hidden and script content off the page
		const paragraph = block.innerText.trim();
		if (paragraph.length === 0) {
			return;
		}

		const response = await requestTranslateParagraph({
			paragraph: paragraph,
			words: lemmas,
		});
		if (response.error || response.translations === null) {
			throw new Error(response.error ?? "Paragraph translation failed.");
		}

		if (ctx.isInvalid) {
			return;
		}

		renderAnnotations({
			block: block,
			matchesByNode: matchesByNode,
			translations: response.translations,
		});
		processedBlocks.add(block);
		block.dataset["wbScanned"] = "1";
	} catch (error: unknown) {
		block.dataset["wbScanned"] = "error";
		onWarn("word-buddy annotator:", error);
	}
}
