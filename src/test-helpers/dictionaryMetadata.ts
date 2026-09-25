import {
	DICTIONARY_METADATA_SCHEMA_VERSION,
	type DictionaryBuildMetadata,
} from "../shared/dictionary/types";

export const TEST_DICTIONARY_METADATA: DictionaryBuildMetadata = {
	artifactSha256: {
		dictShards: ["dict-0-sha"],
		lemmaIndex: "lemma-index-sha",
	},
	filterPolicy: {
		lexicalWordPattern: "^[a-z]+$",
		requireMeaning: true,
		requireQualitySignal: ["bnc"],
		retainLowercaseHeadwordsOnly: true,
	},
	outputs: {
		dictEntries: 1,
		lemmaConflictsSkipped: 0,
		lemmaEntries: 1,
		lemmaExchangeMappings: 0,
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
	schemaVersion: DICTIONARY_METADATA_SCHEMA_VERSION,
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
