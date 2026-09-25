import type {
	DictionaryBuildOutputCounts,
	LemmaIndex,
} from "../../src/shared/dictionary/types";
import { normalizeWord } from "../../src/shared/dictionary/utils";
import { compareCodePoints } from "../../src/shared/utils/compare";
import type { EcdictRow } from "./ecdict";
import {
	type ExchangeMap,
	parseExchangeMap,
	SUPPLEMENTAL_EXCHANGE_CODES,
} from "./exchange";
import { sortStrings } from "./utils";

export interface LemmaBuildResult {
	readonly counts: LemmaCounts;
	readonly index: LemmaIndex;
}

type LemmaCounts = Omit<
	DictionaryBuildOutputCounts,
	"dictEntries" | "rejectedRows"
>;

type MutableLemmaCounts = {
	-readonly [K in keyof LemmaCounts]: LemmaCounts[K];
};

interface LemmaLine {
	readonly lemma: string;
	readonly surfaces: readonly string[];
}

type MappingOutcome = "added" | "conflict" | "same";
type MappingKind = "exchange" | "primary" | "self";

export function countLemmaRows(lemmaText: string): number {
	return lemmaText
		.replaceAll("\r\n", "\n")
		.split("\n")
		.map((line: string): string => line.trim())
		.filter((line: string): boolean => Boolean(line) && !line.startsWith(";"))
		.length;
}

function createLemmaCounts(): MutableLemmaCounts {
	return {
		lemmaConflictsSkipped: 0,
		lemmaEntries: 0,
		lemmaExchangeMappings: 0,
		lemmaPrimaryMappings: 0,
		lemmaSkippedMissingDictionary: 0,
	};
}

function parseLemmaLine(line: string, lineNumber: number): LemmaLine | null {
	const matches = line.match(
		/^(?<lemma>.+?)(?:\/\d+)?\s*->\s*(?<surfaces>.+)$/u,
	);

	const groups = matches?.groups;
	if (!groups) {
		throw new Error(`Malformed lemma.en.txt line ${lineNumber}: ${line}`);
	}

	const rawLemma = groups["lemma"];
	if (rawLemma === undefined) {
		throw new Error(`Malformed lemma.en.txt line ${lineNumber}: ${line}`);
	}

	const lemma = normalizeWord(rawLemma);

	if (!lemma) {
		return null;
	}

	const surfacesText = groups["surfaces"];
	if (surfacesText === undefined) {
		throw new Error(`Malformed lemma.en.txt line ${lineNumber}: ${line}`);
	}

	const surfaces = sortStrings(
		surfacesText
			.split(",")
			.map((surface: string): string | null => normalizeWord(surface))
			.filter((surface: string | null): surface is string => surface !== null),
	);

	return {
		lemma: lemma,
		surfaces: surfaces,
	};
}

function parseLemmaText(lemmaText: string): readonly LemmaLine[] {
	const lemmaLines: LemmaLine[] = [];
	const lines = lemmaText.replaceAll("\r\n", "\n").split("\n");

	for (const [index, rawLine] of lines.entries()) {
		const line = rawLine.trim();

		if (!line || line.startsWith(";")) {
			continue;
		}

		const parsedLine = parseLemmaLine(line, index + 1);

		if (parsedLine) {
			lemmaLines.push(parsedLine);
		}
	}

	if (lemmaLines.length === 0) {
		throw new Error("lemma.en.txt has no usable lemma rows.");
	}

	return lemmaLines;
}

function addLemmaMapping(
	index: Map<string, string>,
	surface: string,
	lemma: string,
): MappingOutcome {
	const existingLemma = index.get(surface);

	if (!existingLemma) {
		index.set(surface, lemma);
		return "added";
	}

	if (existingLemma === lemma) {
		return "same";
	}

	return "conflict";
}

function collectExchangeSurfaces(
	row: EcdictRow,
	exchangeMappings: ExchangeMap,
	lemma: string,
): readonly string[] {
	const surfaces = new Set<string>();
	const rowWord = normalizeWord(row.word);

	if (rowWord && rowWord !== lemma) {
		surfaces.add(rowWord);
	}

	for (const code of SUPPLEMENTAL_EXCHANGE_CODES) {
		const value = exchangeMappings[code];
		const surface = value ? normalizeWord(value) : null;

		if (surface && surface !== lemma) {
			surfaces.add(surface);
		}
	}

	return sortStrings(surfaces);
}

// Self rows exist only to claim their surface before the exchange mappings
// run, so an inflection with its own entry keeps it. The runtime never reads
// them: that surface resolves through its own entry first.
function toLemmaIndex(index: ReadonlyMap<string, string>): LemmaIndex {
	return Object.fromEntries(
		[...index.entries()]
			.filter(([surface, lemma]): boolean => surface !== lemma)
			.sort(([leftSurface], [rightSurface]): number =>
				compareCodePoints(leftSurface, rightSurface),
			),
	);
}

function recordMappingOutcome(
	counts: MutableLemmaCounts,
	outcome: MappingOutcome,
	kind: MappingKind,
): void {
	if (outcome === "same") {
		return;
	}

	if (outcome === "conflict") {
		counts.lemmaConflictsSkipped += 1;
		return;
	}

	if (kind === "self") {
		return;
	}

	if (kind === "primary") {
		counts.lemmaPrimaryMappings += 1;
		return;
	}

	counts.lemmaExchangeMappings += 1;
}

function applyPrimaryLemmaMappings(
	index: Map<string, string>,
	lemmaLines: readonly LemmaLine[],
	wordSet: ReadonlySet<string>,
	counts: MutableLemmaCounts,
): void {
	for (const { lemma, surfaces } of lemmaLines) {
		if (!wordSet.has(lemma)) {
			counts.lemmaSkippedMissingDictionary += 1;
			continue;
		}

		recordMappingOutcome(counts, addLemmaMapping(index, lemma, lemma), "self");

		for (const surface of surfaces) {
			const outcome = addLemmaMapping(index, surface, lemma);
			recordMappingOutcome(counts, outcome, "primary");
		}
	}
}

function applySelfMappings(
	index: Map<string, string>,
	wordSet: ReadonlySet<string>,
	counts: MutableLemmaCounts,
): void {
	for (const word of sortStrings(wordSet)) {
		const outcome = addLemmaMapping(index, word, word);
		recordMappingOutcome(counts, outcome, "self");
	}
}

function resolveExchangeLemma(
	exchangeMappings: ExchangeMap,
	row: EcdictRow,
	wordSet: ReadonlySet<string>,
): string | null {
	const exchangeLemma = normalizeWord(exchangeMappings["0"] ?? row.word);

	if (!exchangeLemma) {
		return null;
	}

	if (!wordSet.has(exchangeLemma)) {
		return null;
	}

	return exchangeLemma;
}

function applyExchangeMappings(
	index: Map<string, string>,
	rows: readonly EcdictRow[],
	wordSet: ReadonlySet<string>,
	counts: MutableLemmaCounts,
): void {
	for (const row of rows) {
		const exchangeMappings = parseExchangeMap(row.exchange, row.word);
		const exchangeLemma = resolveExchangeLemma(exchangeMappings, row, wordSet);

		if (!exchangeLemma) {
			continue;
		}

		const surfaces = collectExchangeSurfaces(
			row,
			exchangeMappings,
			exchangeLemma,
		);

		for (const surface of surfaces) {
			const outcome = addLemmaMapping(index, surface, exchangeLemma);
			recordMappingOutcome(counts, outcome, "exchange");
		}
	}
}

export function buildLemmaIndex(
	rows: readonly EcdictRow[],
	wordSet: ReadonlySet<string>,
	lemmaText: string,
): LemmaBuildResult {
	const lemmaLines = parseLemmaText(lemmaText);
	const index = new Map<string, string>();
	const counts = createLemmaCounts();

	applyPrimaryLemmaMappings(index, lemmaLines, wordSet, counts);
	applySelfMappings(index, wordSet, counts);
	applyExchangeMappings(index, rows, wordSet, counts);
	const lemmaIndex = toLemmaIndex(index);
	counts.lemmaEntries = Object.keys(lemmaIndex).length;

	return {
		counts: counts,
		index: lemmaIndex,
	};
}
