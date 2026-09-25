import {
	DICTIONARY_METADATA_SCHEMA_VERSION,
	type DictionaryArtifactHashes,
	type DictionaryBuildMetadata,
	type DictionaryBuildOutputCounts,
} from "../../src/shared/dictionary/types";
import { LOOKUP_TERM_PATTERN } from "../../src/shared/dictionary/utils";
import type { DictionaryBuildResult } from "./ecdict";
import type { LemmaBuildResult } from "./lemma";
import { DICTIONARY_SOURCES, type DictionarySourceName } from "./sources";
import { QUALITY_SIGNAL_FIELDS } from "./utils";

interface DictionaryBuildMetadataInput {
	readonly artifactSha256: DictionaryArtifactHashes;
	readonly dictionaryBuild: DictionaryBuildResult;
	readonly lemmaBuild: LemmaBuildResult;
	readonly sourceRowCounts: Readonly<Record<DictionarySourceName, number>>;
}

function collectOutputCounts(
	dictionaryBuild: DictionaryBuildResult,
	lemmaBuild: LemmaBuildResult,
): DictionaryBuildOutputCounts {
	return {
		dictEntries: dictionaryBuild.entries.length,
		...lemmaBuild.counts,
		rejectedRows: dictionaryBuild.rejectedRows,
	};
}

export function createDictionaryBuildMetadata(
	input: DictionaryBuildMetadataInput,
): DictionaryBuildMetadata {
	return {
		artifactSha256: input.artifactSha256,
		filterPolicy: {
			lexicalWordPattern: LOOKUP_TERM_PATTERN.source,
			requireMeaning: true,
			requireQualitySignal: [...QUALITY_SIGNAL_FIELDS],
			retainLowercaseHeadwordsOnly: true,
		},
		outputs: collectOutputCounts(input.dictionaryBuild, input.lemmaBuild),
		schemaVersion: DICTIONARY_METADATA_SCHEMA_VERSION,
		sources: {
			ecdict: {
				rowCount: input.sourceRowCounts.ecdict,
				sha256: DICTIONARY_SOURCES.ecdict.sha256,
			},
			lemma: {
				rowCount: input.sourceRowCounts.lemma,
				sha256: DICTIONARY_SOURCES.lemma.sha256,
			},
		},
	};
}
