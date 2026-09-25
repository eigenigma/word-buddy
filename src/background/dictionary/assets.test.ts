import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";
import type { PublicPath } from "wxt/browser";

import type { DictionaryEntry } from "@/shared/dictionary/types";
import { TEST_DICTIONARY_METADATA } from "@/test-helpers/dictionaryMetadata";

import {
	createDictionaryAssetLoader,
	type DictionaryAssetLoader,
	type DictionarySeedManifest,
} from "./assets";

const TEST_DICT_ENTRY: DictionaryEntry = {
	definition: "meeting plan",
	frequency: {
		bnc: 1,
		collins: 1,
		frq: 1,
		oxford: true,
		tags: ["bnc"],
	},
	morphology: {
		exchange: {},
	},
	phonetic: null,
	pos: "n.",
	translation: "议程",
	word: "agenda",
};

const TEST_MANIFEST: DictionarySeedManifest = {
	assetFingerprint: "fingerprint",
	metadata: TEST_DICTIONARY_METADATA,
};

function createLoader(assetBodies: Readonly<Record<string, string>>): {
	readonly fetch: ReturnType<typeof vi.fn<(url: string) => Promise<Response>>>;
	readonly getUrl: ReturnType<typeof vi.fn<(assetPath: PublicPath) => string>>;
	readonly loader: DictionaryAssetLoader;
} {
	const getUrl = vi.fn(
		(assetPath: PublicPath): string => `moz-extension://id${assetPath}`,
	);
	const fetch = vi.fn(async (url: string): Promise<Response> => {
		const body = assetBodies[url];
		return body === undefined
			? new Response("missing", { status: 404 })
			: new Response(body, { status: 200 });
	});

	return {
		fetch: fetch,
		getUrl: getUrl,
		loader: createDictionaryAssetLoader({ fetch: fetch, getUrl: getUrl }),
	};
}

describe("loadManifest", () => {
	it("parses the metadata and fingerprints its exact text", async () => {
		const metadataText = JSON.stringify(TEST_DICTIONARY_METADATA, null, 2);
		const { fetch, loader } = createLoader({
			"moz-extension://id/data/dict-meta.json": metadataText,
		});

		await expect(loader.loadManifest()).resolves.toEqual({
			assetFingerprint: createHash("sha256").update(metadataText).digest("hex"),
			metadata: TEST_DICTIONARY_METADATA,
		});
		expect(fetch).toHaveBeenCalledWith(
			"moz-extension://id/data/dict-meta.json",
		);
	});

	it("throws when the metadata asset fetch fails", async () => {
		const { loader } = createLoader({});

		await expect(loader.loadManifest()).rejects.toThrow(
			"Failed to load dictionary asset /data/dict-meta.json: 404",
		);
	});
});

describe("loadAssets", () => {
	it("loads one shard per manifest hash plus the lemma index", async () => {
		const { getUrl, loader } = createLoader({
			"moz-extension://id/data/dict-0.json": JSON.stringify([TEST_DICT_ENTRY]),
			"moz-extension://id/data/lemma-index.json": JSON.stringify({
				agendas: "agenda",
			}),
		});

		await expect(loader.loadAssets(TEST_MANIFEST)).resolves.toEqual({
			assetFingerprint: "fingerprint",
			dictEntries: [TEST_DICT_ENTRY],
			lemmaEntries: [
				{
					lemma: "agenda",
					surface: "agendas",
				},
			],
			metadata: TEST_DICTIONARY_METADATA,
		});
		expect(getUrl.mock.calls).toEqual([
			["/data/lemma-index.json"],
			["/data/dict-0.json"],
		]);
	});

	it("rejects invalid dictionary asset payloads", async () => {
		const { loader } = createLoader({
			"moz-extension://id/data/dict-0.json": JSON.stringify([{ word: 1 }]),
			"moz-extension://id/data/lemma-index.json": JSON.stringify({
				agendas: "agenda",
			}),
		});

		await expect(loader.loadAssets(TEST_MANIFEST)).rejects.toThrow();
	});
});
