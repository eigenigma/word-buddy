import { createHash } from "node:crypto";

import { describe, expect, it, type Mock, vi } from "vitest";
import type { PublicPath } from "wxt/browser";

import type { DictionaryEntry } from "@/shared/dictionary/types";
import { createTestDictionaryEntry } from "@/test-helpers/dictionaryFixtures";
import { TEST_DICTIONARY_METADATA } from "@/test-helpers/dictionaryMetadata";

import {
	createDictionaryAssetLoader,
	type DictionaryAssetLoader,
	type DictionaryAssetLoaderDependencies,
	type DictionarySeedManifest,
} from "./assets";

const TEST_DICT_ENTRY: DictionaryEntry = createTestDictionaryEntry("agenda");

const TEST_MANIFEST: DictionarySeedManifest = {
	assetFingerprint: "fingerprint",
	metadata: TEST_DICTIONARY_METADATA,
};

function createLoader(assetBodies: Readonly<Record<string, string>>): {
	readonly fetch: Mock<DictionaryAssetLoaderDependencies["fetch"]>;
	readonly getUrl: Mock<DictionaryAssetLoaderDependencies["getUrl"]>;
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

	it("changes the fingerprint when only an artifact hash changes", async () => {
		const loadFingerprint = async (lemmaIndexSha: string): Promise<string> => {
			const { loader } = createLoader({
				"moz-extension://id/data/dict-meta.json": JSON.stringify({
					...TEST_DICTIONARY_METADATA,
					artifactSha256: {
						...TEST_DICTIONARY_METADATA.artifactSha256,
						lemmaIndex: lemmaIndexSha,
					},
				}),
			});
			return (await loader.loadManifest()).assetFingerprint;
		};

		expect(await loadFingerprint("rebuilt-sha")).not.toBe(
			await loadFingerprint(TEST_DICTIONARY_METADATA.artifactSha256.lemmaIndex),
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
			dictEntries: [TEST_DICT_ENTRY],
			lemmaEntries: [
				{
					lemma: "agenda",
					surface: "agendas",
				},
			],
		});
		expect(getUrl.mock.calls.flat().sort()).toEqual([
			"/data/dict-0.json",
			"/data/lemma-index.json",
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
