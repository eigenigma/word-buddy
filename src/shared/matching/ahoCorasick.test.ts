import { expect, it } from "vitest";

import {
	type AhoCorasickMatch,
	createAhoCorasickMatcher,
	isWholeWordMatch,
	type PatternRef,
} from "./ahoCorasick";

function findWholeWordMatches(
	patterns: readonly PatternRef[],
	text: string,
): readonly AhoCorasickMatch[] {
	const matcher = createAhoCorasickMatcher(patterns);
	return matcher
		.findAll(text)
		.filter((match) => isWholeWordMatch(text, match.start, match.end));
}

function summarizeMatches(
	matches: readonly AhoCorasickMatch[],
): readonly string[] {
	return matches.map(
		(match) => `${match.lemma}:${match.surface}:${match.start}-${match.end}`,
	);
}

function createDeterministicRandom(seed: number): () => number {
	let state = seed;

	return (): number => {
		state = (state * 1_664_525 + 1_013_904_223) >>> 0;
		return state / 4_294_967_296;
	};
}

function createRandomWord(length: number, random: () => number): string {
	const alphabet = "abcdefghijklmnopqrstuvwxyz";
	let word = "";

	for (let index = 0; index < length; index += 1) {
		const alphabetIndex = Math.floor(random() * alphabet.length);
		word += alphabet[alphabetIndex] ?? "a";
	}

	return word;
}

it("matches a single pattern and ignores substring hits", () => {
	const matcher = createAhoCorasickMatcher([{ lemma: "cat", surface: "cat" }]);
	const text = "The cat sat";
	const matches = matcher
		.findAll(text)
		.filter((match) => isWholeWordMatch(text, match.start, match.end));

	expect(matcher.patternCount).toBe(1);
	expect(matcher.findAll("")).toHaveLength(0);
	expect(summarizeMatches(matches)).toStrictEqual(["cat:cat:4-7"]);
	expect(
		findWholeWordMatches([{ lemma: "cat", surface: "cat" }], "concatenate"),
	).toHaveLength(0);
});

it("returns the expected whole-word set for overlapping patterns", () => {
	const matches = findWholeWordMatches(
		[
			{ lemma: "he", surface: "he" },
			{ lemma: "her", surface: "her" },
			{ lemma: "here", surface: "here" },
			{ lemma: "there", surface: "there" },
		],
		"There is her cat here",
	);

	expect(summarizeMatches(matches)).toStrictEqual([
		"there:there:0-5",
		"her:her:9-12",
		"here:here:17-21",
	]);
});

it("does not match across apostrophe and hyphen boundaries", () => {
	expect(
		findWholeWordMatches([{ lemma: "dont", surface: "dont" }], "don't"),
	).toHaveLength(0);
	expect(
		findWholeWordMatches([{ lemma: "can", surface: "can" }], "can't"),
	).toHaveLength(0);
	expect(
		findWholeWordMatches(
			[{ lemma: "state", surface: "state" }],
			"state-of-the-art",
		),
	).toHaveLength(0);
});

it("stays within the legacy matcher latency budget", () => {
	const random = createDeterministicRandom(42);
	const patterns: PatternRef[] = [];
	for (let index = 0; index < 3000; index += 1) {
		patterns.push({
			lemma: `lemma-${index}`,
			surface: createRandomWord(8, random),
		});
	}

	const buildStartedAt = performance.now();
	const matcher = createAhoCorasickMatcher(patterns);
	const buildDuration = performance.now() - buildStartedAt;

	expect(buildDuration).toBeLessThan(50);

	const scanText = Array.from({ length: 1112 }, () =>
		createRandomWord(8, random),
	).join(" ");
	expect(scanText.length).toBeGreaterThanOrEqual(10_000);

	const scanStartedAt = performance.now();
	matcher.findAll(scanText);
	const scanDuration = performance.now() - scanStartedAt;

	expect(scanDuration).toBeLessThan(10);
});

it("is deterministic across repeated scans", () => {
	const patterns: readonly PatternRef[] = [
		{ lemma: "there", surface: "there" },
		{ lemma: "her", surface: "her" },
		{ lemma: "cat", surface: "cat" },
		{ lemma: "here", surface: "here" },
	];
	const matcher = createAhoCorasickMatcher(patterns);
	const text = "There is her cat here";

	expect(JSON.stringify(matcher.findAll(text))).toBe(
		JSON.stringify(matcher.findAll(text)),
	);
});

it("preserves matches for multiple surfaces of the same lemma", () => {
	const matches = findWholeWordMatches(
		[
			{ lemma: "run", surface: "run" },
			{ lemma: "run", surface: "ran" },
			{ lemma: "run", surface: "running" },
		],
		"He ran while running on run lane",
	);

	expect(summarizeMatches(matches)).toStrictEqual([
		"run:ran:3-6",
		"run:running:13-20",
		"run:run:24-27",
	]);
});
