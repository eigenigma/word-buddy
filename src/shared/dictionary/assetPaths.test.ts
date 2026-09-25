import { describe, expect, it } from "vitest";

import {
	DICTIONARY_META_PUBLIC_PATH,
	dictShardPublicPath,
	LEMMA_INDEX_PUBLIC_PATH,
} from "./assetPaths";

describe("dictionary asset paths", () => {
	it("builds the public paths the extension fetches", () => {
		expect(DICTIONARY_META_PUBLIC_PATH).toBe("/data/dict-meta.json");
		expect(LEMMA_INDEX_PUBLIC_PATH).toBe("/data/lemma-index.json");
		expect(dictShardPublicPath(3)).toBe("/data/dict-3.json");
	});
});
