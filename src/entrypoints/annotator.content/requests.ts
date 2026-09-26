import type { LemmaExpansions } from "@/shared/dictionary/types";
import type {
	TranslateParagraphInput,
	TranslationMap,
} from "@/shared/llm/types";
import {
	type AhoCorasickMatcher,
	createAhoCorasickMatcher,
	type PatternRef,
} from "@/shared/matching/ahoCorasick";
import { requestExpandLemmas } from "@/shared/runtime/dictionaryClient";
import { requestTranslateParagraph } from "@/shared/runtime/llmClient";
import { requestWordbookList } from "@/shared/runtime/wordbookClient";

function buildPatternRefs(
	lemmas: readonly string[],
	expansions: LemmaExpansions,
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

export async function requestBlockTranslations(
	input: TranslateParagraphInput,
): Promise<TranslationMap> {
	const response = await requestTranslateParagraph(input);
	if (response.error || response.translations === null) {
		throw new Error(response.error ?? "Paragraph translation failed.");
	}

	return response.translations;
}
