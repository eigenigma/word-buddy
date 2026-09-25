import type { DictionaryBuildMetadata } from "../shared/dictionary/types";

export const TEST_DICTIONARY_METADATA: DictionaryBuildMetadata = {
	dictShardCount: 1,
	filterPolicy: {
		lexicalWordPattern: "^[a-z]+$",
		requireMeaning: true,
		requireQualitySignal: ["bnc"],
		retainLowercaseHeadwordsOnly: true,
	},
	outputs: {
		dictEntries: 1,
		duplicateDictEntriesDiscarded: 0,
		lemmaConflictsSkipped: 0,
		lemmaExchangeMappings: 0,
		lemmaEntries: 1,
		lemmaPrimaryMappings: 1,
		lemmaSelfMappings: 1,
		lemmaSkippedMissingDictionary: 0,
		rejectedRows: {
			duplicateWord: 0,
			emptyMeaning: 0,
			nonLexicalWord: 0,
			weakSignal: 0,
		},
	},
	schemaVersion: 1,
	sources: {
		ecdict: {
			rowCount: 1,
			sha256: "dict-sha",
		},
		lemma: {
			rowCount: 1,
			sha256: "lemma-sha",
		},
	},
};
