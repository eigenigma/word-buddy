export const EXCHANGE_CODES = [
	"0",
	"1",
	"3",
	"d",
	"f",
	"i",
	"p",
	"r",
	"s",
	"t",
] as const;

export type ExchangeCode = (typeof EXCHANGE_CODES)[number];

export interface DictionaryFrequencyMetadata {
	readonly bnc: number | null;
	readonly collins: number | null;
	readonly frq: number | null;
	readonly oxford: boolean;
	readonly tags: readonly string[];
}

export interface DictionaryMorphologyMetadata {
	readonly exchange: Readonly<Partial<Record<ExchangeCode, string>>>;
}

export interface DictionaryEntry {
	readonly definition: string | null;
	readonly frequency: DictionaryFrequencyMetadata;
	readonly morphology: DictionaryMorphologyMetadata;
	readonly phonetic: string | null;
	readonly pos: string | null;
	readonly translation: string | null;
	readonly word: string;
}

export interface LemmaEntry {
	readonly lemma: string;
	readonly surface: string;
}

export type LemmaIndex = Readonly<Record<string, string>>;

export interface DictionarySourceMetadata {
	readonly rowCount: number;
	readonly sha256: string;
}

export interface DictionaryRejectionCounts {
	readonly duplicateWord: number;
	readonly emptyMeaning: number;
	readonly nonLexicalWord: number;
	readonly weakSignal: number;
}

export interface DictionaryBuildOutputCounts {
	readonly dictEntries: number;
	readonly duplicateDictEntriesDiscarded: number;
	readonly lemmaConflictsSkipped: number;
	readonly lemmaExchangeMappings: number;
	readonly lemmaEntries: number;
	readonly lemmaPrimaryMappings: number;
	readonly lemmaSelfMappings: number;
	readonly lemmaSkippedMissingDictionary: number;
	readonly rejectedRows: DictionaryRejectionCounts;
}

export interface DictionaryBuildMetadata {
	readonly dictShardCount: number;
	readonly filterPolicy: {
		readonly lexicalWordPattern: string;
		readonly requireMeaning: boolean;
		readonly requireQualitySignal: readonly string[];
		readonly retainLowercaseHeadwordsOnly: boolean;
	};
	readonly outputs: DictionaryBuildOutputCounts;
	readonly schemaVersion: 1;
	readonly sources: {
		readonly ecdict: DictionarySourceMetadata;
		readonly lemma: DictionarySourceMetadata;
	};
}
