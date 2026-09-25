import { expect, it } from "vitest";

import { createAhoCorasickMatcher, type PatternRef } from "./ahoCorasick";

const PATTERN_COUNT = 3000;
const WORD_LENGTH = 8;
const SCAN_WORD_COUNT = 1112;
const SCAN_TEXT_MIN_LENGTH = 10_000;
const SPARSE_MATCH_INTERVAL = 50;
const DENSE_MATCH_INTERVAL = 2;

interface ScanCase {
	readonly expectedMatchCount: number;
	readonly label: string;
	readonly text: string;
}

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
const FILLER_WORDS: readonly string[] = Array.from(
	{ length: SCAN_WORD_COUNT },
	() => createRandomWord(seededRandom),
);

// Every matchInterval-th filler word becomes the next unused pattern surface,
// so the hits spread across the automaton instead of repeating one path.
function createMixedScanCase(label: string, matchInterval: number): ScanCase {
	const words = FILLER_WORDS.map((word: string, index: number): string => {
		if (index % matchInterval !== 0) {
			return word;
		}

		const pattern = PATTERNS[index / matchInterval];
		if (pattern === undefined) {
			throw new Error(`Only ${PATTERN_COUNT} pattern surfaces to mix in.`);
		}
		return pattern.surface;
	});

	return {
		expectedMatchCount: Math.ceil(FILLER_WORDS.length / matchInterval),
		label: label,
		text: words.join(" "),
	};
}

const SCAN_CASES: readonly ScanCase[] = [
	{ expectedMatchCount: 0, label: "no-match", text: FILLER_WORDS.join(" ") },
	createMixedScanCase("sparse", SPARSE_MATCH_INTERVAL),
	createMixedScanCase("dense", DENSE_MATCH_INTERVAL),
];

it(`builds a matcher for ${PATTERN_COUNT} wordbook surfaces`, async ({
	bench,
}) => {
	expect(createAhoCorasickMatcher(PATTERNS).patternCount).toBe(PATTERN_COUNT);

	await bench("build", () => {
		createAhoCorasickMatcher(PATTERNS);
	}).run();
});

it.for(SCAN_CASES)(
	`scans $label text of ${SCAN_TEXT_MIN_LENGTH}+ characters against ${PATTERN_COUNT} surfaces`,
	async (scanCase: ScanCase, { bench }) => {
		const matcher = createAhoCorasickMatcher(PATTERNS);
		expect(scanCase.text.length).toBeGreaterThanOrEqual(SCAN_TEXT_MIN_LENGTH);
		expect(matcher.findAll(scanCase.text)).toHaveLength(
			scanCase.expectedMatchCount,
		);

		await bench(`findAll ${scanCase.label}`, () => {
			matcher.findAll(scanCase.text);
		}).run();
	},
);
