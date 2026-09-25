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
const GO_DICT_ENTRY: DictionaryEntry = createTestDictionaryEntry("go");

const TWO_SHARD_MANIFEST: DictionarySeedManifest = {
	assetFingerprint: "fingerprint",
	metadata: {
		...TEST_DICTIONARY_METADATA,
		artifactSha256: {
			...TEST_DICTIONARY_METADATA.artifactSha256,
			dictShards: ["dict-0-sha", "dict-1-sha"],
		},
	},
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

describe("loadDictShards", () => {
	it("yields every shard the manifest lists, in order", async () => {
		const { loader } = createLoader({
			"moz-extension://id/data/dict-0.json": JSON.stringify([TEST_DICT_ENTRY]),
			"moz-extension://id/data/dict-1.json": JSON.stringify([GO_DICT_ENTRY]),
		});

		await expect(
			Array.fromAsync(loader.loadDictShards(TWO_SHARD_MANIFEST)),
		).resolves.toEqual([[TEST_DICT_ENTRY], [GO_DICT_ENTRY]]);
	});

	it("fetches a shard only when the consumer asks for it", async () => {
		const { getUrl, loader } = createLoader({
			"moz-extension://id/data/dict-0.json": JSON.stringify([TEST_DICT_ENTRY]),
			"moz-extension://id/data/dict-1.json": JSON.stringify([GO_DICT_ENTRY]),
		});
		const shards = loader
			.loadDictShards(TWO_SHARD_MANIFEST)
			[Symbol.asyncIterator]();

		await shards.next();

		expect(getUrl.mock.calls).toEqual([["/data/dict-0.json"]]);
	});

	it("rejects an invalid shard payload", async () => {
		const { loader } = createLoader({
			"moz-extension://id/data/dict-0.json": JSON.stringify([{ word: 1 }]),
		});

		await expect(
			Array.fromAsync(loader.loadDictShards(TWO_SHARD_MANIFEST)),
		).rejects.toThrow();
	});
});

describe("loadLemmaEntries", () => {
	it("turns the lemma index into surface rows", async () => {
		const { loader } = createLoader({
			"moz-extension://id/data/lemma-index.json": JSON.stringify({
				agendas: "agenda",
			}),
		});

		await expect(loader.loadLemmaEntries()).resolves.toEqual([
			{ lemma: "agenda", surface: "agendas" },
		]);
	});
});
