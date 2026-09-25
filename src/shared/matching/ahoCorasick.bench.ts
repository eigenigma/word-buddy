import { expect, it } from "vitest";

import { createAhoCorasickMatcher, type PatternRef } from "./ahoCorasick";

const PATTERN_COUNT = 3000;
const WORD_LENGTH = 8;
const SCAN_WORD_COUNT = 1112;
const SCAN_TEXT_MIN_LENGTH = 10_000;

function createDeterministicRandom(seed: number): () => number {
	let state = seed;

	return (): number => {
		state = (state * 1_664_525 + 1_013_904_223) >>> 0;
		return state / 4_294_967_296;
	};
}

function createRandomWord(random: () => number): string {
	const alphabet = "abcdefghijklmnopqrstuvwxyz";
	let word = "";

	for (let index = 0; index < WORD_LENGTH; index += 1) {
		word += alphabet.charAt(Math.floor(random() * alphabet.length));
	}

	return word;
}

const seededRandom = createDeterministicRandom(42);
const PATTERNS: readonly PatternRef[] = Array.from(
	{ length: PATTERN_COUNT },
	(_, index): PatternRef => ({
		lemma: `lemma-${index}`,
		surface: createRandomWord(seededRandom),
	}),
);
const SCAN_TEXT = Array.from({ length: SCAN_WORD_COUNT }, () =>
	createRandomWord(seededRandom),
).join(" ");

it(`builds a matcher for ${PATTERN_COUNT} wordbook surfaces`, async ({
	bench,
}) => {
	expect(createAhoCorasickMatcher(PATTERNS).patternCount).toBe(PATTERN_COUNT);

	await bench("build", () => {
		createAhoCorasickMatcher(PATTERNS);
	}).run();
});

it(`scans ${SCAN_TEXT_MIN_LENGTH} characters against ${PATTERN_COUNT} surfaces`, async ({
	bench,
}) => {
	const matcher = createAhoCorasickMatcher(PATTERNS);
	expect(SCAN_TEXT.length).toBeGreaterThanOrEqual(SCAN_TEXT_MIN_LENGTH);

	await bench("findAll", () => {
		matcher.findAll(SCAN_TEXT);
	}).run();
});
