import { parse } from "csv-parse/sync";
import { z } from "zod";

import {
	type DictionaryEntry,
	type DictionaryRejectionCounts,
	EXCHANGE_CODES,
	type ExchangeCode,
} from "../../src/shared/dictionary/types";
import { normalizeLookupTerm } from "../../src/shared/dictionary/utils";
import {
	compareCodeUnits,
	normalizeText,
	parseInteger,
	sortStrings,
} from "./utils";

export interface DictionaryBuildResult {
	readonly entries: readonly DictionaryEntry[];
	readonly rejectedRows: DictionaryRejectionCounts;
	readonly wordSet: ReadonlySet<string>;
}

function splitTags(value: string | null): readonly string[] {
	if (!value) {
		return [];
	}

	const tags = value
		.split(/[\s,]+/u)
		.map((tag: string): string => tag.trim())
		.filter(Boolean);

	return sortStrings(tags);
}

function toOxfordFlag(value: string): boolean {
	return normalizeText(value) === "1";
}

const TextColumnSchema = z.string().transform(normalizeText);
const IntegerColumnSchema = z.string().transform(parseInteger);

const EcdictRowSchema = z
	.object({
		audio: TextColumnSchema,
		bnc: IntegerColumnSchema,
		collins: IntegerColumnSchema,
		definition: TextColumnSchema,
		detail: TextColumnSchema,
		exchange: TextColumnSchema,
		frq: IntegerColumnSchema,
		oxford: z.string().transform(toOxfordFlag),
		phonetic: TextColumnSchema,
		pos: TextColumnSchema,
		tag: TextColumnSchema,
		translation: TextColumnSchema,
		word: z.string().trim(),
	})
	.readonly();

export type EcdictRow = z.output<typeof EcdictRowSchema>;

const ExchangeCodeSchema = z.enum(EXCHANGE_CODES);

function parseEcdictRow(record: unknown, rowNumber: number): EcdictRow {
	const result = EcdictRowSchema.safeParse(record);
	if (!result.success) {
		throw new Error(
			`Malformed ecdict.csv row ${rowNumber}: ${z.prettifyError(result.error)}`,
		);
	}

	return result.data;
}

export function parseEcdictCsv(csvText: string): readonly EcdictRow[] {
	const records = parse(csvText, {
		bom: true,
		columns: true,
		skip_empty_lines: true,
		trim: true,
	});

	if (records.length === 0) {
		throw new Error("ecdict.csv has no data rows.");
	}

	return records.map(
		(record: unknown, index: number): EcdictRow =>
			parseEcdictRow(record, index + 2),
	);
}

function hasMeaning(row: EcdictRow): boolean {
	return row.definition !== null || row.translation !== null;
}

function hasQualitySignal(row: EcdictRow): boolean {
	return (
		(row.bnc ?? 0) > 0 ||
		(row.frq ?? 0) > 0 ||
		(row.collins ?? 0) > 0 ||
		row.oxford
	);
}

export function parseExchangeMap(
	exchange: string | null,
	word: string,
): Partial<Record<ExchangeCode, string>> {
	if (!exchange) {
		return {};
	}

	const mappings: Partial<Record<ExchangeCode, string>> = {};
	const parts = exchange.split("/");

	for (const part of parts) {
		const [rawCode, rawValue] = part.split(":", 2);
		const codeResult = ExchangeCodeSchema.safeParse(rawCode);

		if (!codeResult.success || rawValue === undefined) {
			throw new Error(`Malformed exchange value for ${word}: ${exchange}`);
		}

		const normalizedValue = rawValue.trim();
		if (!normalizedValue) {
			continue;
		}

		mappings[codeResult.data] = normalizedValue;
	}

	return mappings;
}

function toDictionaryEntry(
	row: EcdictRow,
	normalizedWord: string,
): DictionaryEntry {
	return {
		definition: row.definition,
		frequency: {
			bnc: row.bnc,
			collins: row.collins,
			frq: row.frq,
			oxford: row.oxford,
			tags: splitTags(row.tag),
		},
		morphology: {
			exchange: parseExchangeMap(row.exchange, row.word),
		},
		phonetic: row.phonetic,
		pos: row.pos,
		translation: row.translation,
		word: normalizedWord,
	};
}

type EntryComparator = (
	left: DictionaryEntry,
	right: DictionaryEntry,
) => number;

function compareNullableNumber(
	left: number | null,
	right: number | null,
	compareNonNull: (leftNumber: number, rightNumber: number) => number,
): number {
	if (left === right) {
		return 0;
	}

	if (left === null) {
		return -1;
	}

	if (right === null) {
		return 1;
	}

	return compareNonNull(left, right);
}

function compareStringLength(
	left: string | null,
	right: string | null,
): number {
	return (left?.length ?? 0) - (right?.length ?? 0);
}

const ENTRY_COMPARATORS: readonly EntryComparator[] = [
	(left: DictionaryEntry, right: DictionaryEntry): number =>
		Number(left.frequency.oxford) - Number(right.frequency.oxford),
	(left: DictionaryEntry, right: DictionaryEntry): number =>
		compareNullableNumber(
			left.frequency.collins,
			right.frequency.collins,
			(leftValue: number, rightValue: number): number => leftValue - rightValue,
		),
	(left: DictionaryEntry, right: DictionaryEntry): number =>
		Number(left.frequency.bnc !== null) - Number(right.frequency.bnc !== null),
	(left: DictionaryEntry, right: DictionaryEntry): number =>
		compareNullableNumber(
			left.frequency.bnc,
			right.frequency.bnc,
			(leftValue: number, rightValue: number): number => rightValue - leftValue,
		),
	(left: DictionaryEntry, right: DictionaryEntry): number =>
		compareNullableNumber(
			left.frequency.frq,
			right.frequency.frq,
			(leftValue: number, rightValue: number): number => rightValue - leftValue,
		),
	(left: DictionaryEntry, right: DictionaryEntry): number =>
		compareStringLength(left.translation, right.translation),
	(left: DictionaryEntry, right: DictionaryEntry): number =>
		compareStringLength(left.definition, right.definition),
	(left: DictionaryEntry, right: DictionaryEntry): number =>
		Number(Boolean(left.phonetic)) - Number(Boolean(right.phonetic)),
];

function compareEntries(left: DictionaryEntry, right: DictionaryEntry): number {
	for (const comparator of ENTRY_COMPARATORS) {
		const comparison = comparator(left, right);

		if (comparison !== 0) {
			return comparison;
		}
	}

	return 0;
}

function sortEntries(
	entries: Iterable<DictionaryEntry>,
): readonly DictionaryEntry[] {
	return [...entries].sort(
		(left: DictionaryEntry, right: DictionaryEntry): number =>
			compareCodeUnits(left.word, right.word),
	);
}

export function buildDictionaryEntries(
	rows: readonly EcdictRow[],
): DictionaryBuildResult {
	const candidates = new Map<string, DictionaryEntry>();
	const rejectedRows = {
		duplicateWord: 0,
		emptyMeaning: 0,
		nonLexicalWord: 0,
		weakSignal: 0,
	};

	for (const row of rows) {
		const normalizedWord = normalizeLookupTerm(row.word);

		if (!normalizedWord || normalizedWord !== row.word) {
			rejectedRows.nonLexicalWord += 1;
			continue;
		}

		if (!hasMeaning(row)) {
			rejectedRows.emptyMeaning += 1;
			continue;
		}

		if (!hasQualitySignal(row)) {
			rejectedRows.weakSignal += 1;
			continue;
		}

		const candidate = toDictionaryEntry(row, normalizedWord);
		const currentEntry = candidates.get(candidate.word);

		if (!currentEntry) {
			candidates.set(candidate.word, candidate);
			continue;
		}

		rejectedRows.duplicateWord += 1;

		if (compareEntries(candidate, currentEntry) > 0) {
			candidates.set(candidate.word, candidate);
		}
	}

	const entries = sortEntries(candidates.values());
	const wordSet = new Set(
		entries.map((entry: DictionaryEntry): string => entry.word),
	);

	return {
		entries: entries,
		rejectedRows: rejectedRows,
		wordSet: wordSet,
	};
}
