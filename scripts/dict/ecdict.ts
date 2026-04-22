import { parse } from "csv-parse/sync";

import {
	type DictionaryEntry,
	EXCHANGE_CODES,
	type ExchangeCode,
} from "../../src/shared/dictionary/types";
import { normalizeLookupTerm } from "../../src/shared/dictionary/utils";
import { normalizeText, parseInteger, sortStrings } from "./utils";

export interface EcdictRow {
	readonly audio: string | null;
	readonly bnc: number | null;
	readonly collins: number | null;
	readonly definition: string | null;
	readonly detail: string | null;
	readonly exchange: string | null;
	readonly frq: number | null;
	readonly oxford: boolean;
	readonly phonetic: string | null;
	readonly pos: string | null;
	readonly tag: string | null;
	readonly translation: string | null;
	readonly word: string;
}

export interface DictionaryBuildResult {
	readonly counts: {
		readonly duplicateDictEntriesDiscarded: number;
		readonly rejectedRows: {
			readonly duplicateWord: number;
			readonly emptyMeaning: number;
			readonly nonLexicalWord: number;
			readonly weakSignal: number;
		};
	};
	readonly entries: readonly DictionaryEntry[];
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

type EcdictRowColumn = keyof EcdictRow;
type MutableEcdictRow = {
	-readonly [Column in EcdictRowColumn]: EcdictRow[Column];
};
type EcdictRowColumnParser<Column extends EcdictRowColumn = EcdictRowColumn> = {
	readonly column: Column;
	readonly parser: (value: string) => EcdictRow[Column];
};

const ECDICT_ROW_COLUMN_PARSERS: readonly EcdictRowColumnParser[] = [
	{ column: "audio", parser: normalizeText },
	{ column: "bnc", parser: parseInteger },
	{ column: "collins", parser: parseInteger },
	{ column: "definition", parser: normalizeText },
	{ column: "detail", parser: normalizeText },
	{ column: "exchange", parser: normalizeText },
	{ column: "frq", parser: parseInteger },
	{
		column: "oxford",
		parser: (value: string): boolean => normalizeText(value) === "1",
	},
	{ column: "phonetic", parser: normalizeText },
	{ column: "pos", parser: normalizeText },
	{ column: "tag", parser: normalizeText },
	{ column: "translation", parser: normalizeText },
	{ column: "word", parser: (value: string): string => value.trim() },
];

function setParsedEcdictColumn<Column extends EcdictRowColumn>(
	row: Partial<MutableEcdictRow>,
	column: Column,
	value: EcdictRow[Column],
): void {
	(row as MutableEcdictRow)[column] = value;
}

function parseEcdictRow(
	record: Record<string, string>,
	rowNumber: number,
): EcdictRow {
	const missingColumns: EcdictRowColumn[] = [];
	const parsedRow: Partial<MutableEcdictRow> = {};

	for (const { column, parser } of ECDICT_ROW_COLUMN_PARSERS) {
		const value = record[column];

		if (value === undefined) {
			missingColumns.push(column);
			continue;
		}

		setParsedEcdictColumn(parsedRow, column, parser(value));
	}

	if (missingColumns.length > 0) {
		throw new Error(
			`Malformed ecdict.csv row ${rowNumber}: missing columns ${missingColumns.join(", ")}.`,
		);
	}

	return parsedRow as EcdictRow;
}

export function parseEcdictCsv(csvText: string): readonly EcdictRow[] {
	const records = parse(csvText, {
		bom: true,
		columns: true,
		skip_empty_lines: true,
		trim: true,
	}) as Record<string, string>[];

	if (records.length === 0) {
		throw new Error("ecdict.csv has no data rows.");
	}

	return records.map(
		(record: Record<string, string>, index: number): EcdictRow =>
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
		const code = rawCode as ExchangeCode | undefined;
		const normalizedValue = rawValue?.trim();

		if (!code) {
			throw new Error(`Malformed exchange value for ${word}: ${exchange}`);
		}

		if (!EXCHANGE_CODES.includes(code)) {
			throw new Error(`Malformed exchange value for ${word}: ${exchange}`);
		}

		if (rawValue === undefined) {
			throw new Error(`Malformed exchange value for ${word}: ${exchange}`);
		}

		if (!normalizedValue) {
			continue;
		}

		mappings[code] = normalizedValue;
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
			left.word.localeCompare(right.word),
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
		counts: {
			duplicateDictEntriesDiscarded: rejectedRows.duplicateWord,
			rejectedRows: rejectedRows,
		},
		entries: entries,
		wordSet: wordSet,
	};
}
