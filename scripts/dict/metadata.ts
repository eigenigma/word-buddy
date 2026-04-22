import type {
	DictionaryBuildMetadata,
	DictionaryBuildOutputCounts,
} from "../../src/shared/dictionary/types";
import { LOOKUP_TERM_PATTERN } from "../../src/shared/dictionary/utils";
import { QUALITY_SIGNAL_FIELDS } from "./utils";

export function createDictionaryBuildMetadata(
	ecdictRowCount: number,
	lemmaRowCount: number,
	ecdictHash: string,
	lemmaHash: string,
	outputCounts: DictionaryBuildOutputCounts,
	dictShardCount: number,
): DictionaryBuildMetadata {
	return {
		dictShardCount: dictShardCount,
		filterPolicy: {
			lexicalWordPattern: LOOKUP_TERM_PATTERN.source,
			requireMeaning: true,
			requireQualitySignal: [...QUALITY_SIGNAL_FIELDS],
			retainLowercaseHeadwordsOnly: true,
		},
		outputs: outputCounts,
		schemaVersion: 1,
		sources: {
			ecdict: {
				rowCount: ecdictRowCount,
				sha256: ecdictHash,
			},
			lemma: {
				rowCount: lemmaRowCount,
				sha256: lemmaHash,
			},
		},
	};
}
