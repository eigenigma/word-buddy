import type { DictionaryBuildMetadata } from "../../src/shared/dictionary/types";

export interface DictionarySource {
	readonly path: string;
	readonly sha256: string;
	readonly url: string;
}

export type DictionarySourceName = keyof DictionaryBuildMetadata["sources"];

export const DICTIONARY_SOURCES: Readonly<
	Record<DictionarySourceName, DictionarySource>
> = {
	ecdict: {
		path: "data/raw/ecdict.csv",
		sha256: "1a6947e04785db63613a92e14903cdae7954f7e84860b10e68e5c7cbb3f9c3cf",
		url: "https://raw.githubusercontent.com/skywind3000/ECDICT/bc015ed2e24a7abef49fc6dbbb7fe32c1dadaf8b/ecdict.csv",
	},
	lemma: {
		path: "data/raw/lemma.en.txt",
		sha256: "e255b097404e3e0052060e2ddf6e15a1414f577071d63d51d2ca0ce9dacee0fc",
		url: "https://raw.githubusercontent.com/skywind3000/lemma.en/f399e203ac183b97c9860c9acb43e33912bee5ea/lemma.en.txt",
	},
};
