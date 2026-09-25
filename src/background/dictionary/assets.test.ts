import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DictionaryEntry } from "@/shared/dictionary/types";
import { TEST_DICTIONARY_METADATA } from "@/test-helpers/dictionaryMetadata";

import {
	type DictionarySeedManifest,
	loadDictionarySeedAssets,
	loadDictionarySeedManifest,
} from "./assets";

const fetchMock = vi.fn();
const getUrlMock = vi.fn();
const digestMock = vi.fn();

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

beforeEach(() => {
	fetchMock.mockReset();
	getUrlMock.mockReset();
	digestMock.mockReset();
	vi.stubGlobal("browser", {
		runtime: {
			getURL: getUrlMock,
		},
	});
	vi.stubGlobal("fetch", fetchMock);
	Object.defineProperty(globalThis.crypto, "subtle", {
		configurable: true,
		value: {
			digest: digestMock,
		},
	});
	getUrlMock.mockImplementation(
		(assetPath: string): string => `moz-extension://${assetPath}`,
	);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("loadDictionarySeedManifest", () => {
	it("loads metadata and computes an asset fingerprint", async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify(TEST_DICTIONARY_METADATA), {
				status: 200,
			}),
		);
		digestMock.mockResolvedValue(new Uint8Array([0, 171, 255]).buffer);

		await expect(loadDictionarySeedManifest()).resolves.toEqual({
			assetFingerprint: "00abff",
			metadata: TEST_DICTIONARY_METADATA,
		});
		expect(getUrlMock).toHaveBeenCalledWith("/data/dict-meta.json");
		expect(fetchMock).toHaveBeenCalledWith(
			"moz-extension:///data/dict-meta.json",
		);
	});

	it("throws when the metadata asset fetch fails", async () => {
		fetchMock.mockResolvedValue(new Response("missing", { status: 500 }));

		await expect(loadDictionarySeedManifest()).rejects.toThrow(
			"Failed to load dictionary asset /data/dict-meta.json: 500",
		);
	});
});

describe("loadDictionarySeedAssets", () => {
	it("loads dictionary shards and lemma assets using the provided manifest", async () => {
		const manifest: DictionarySeedManifest = {
			assetFingerprint: "fingerprint",
			metadata: TEST_DICTIONARY_METADATA,
		};
		fetchMock
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ agendas: "agenda" }), { status: 200 }),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify([TEST_DICT_ENTRY]), { status: 200 }),
			);

		await expect(loadDictionarySeedAssets(manifest)).resolves.toEqual({
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
		expect(getUrlMock.mock.calls).toEqual([
			["/data/lemma-index.json"],
			["/data/dict-0.json"],
		]);
	});

	it("rejects invalid dictionary asset payloads", async () => {
		const manifest: DictionarySeedManifest = {
			assetFingerprint: "fingerprint",
			metadata: TEST_DICTIONARY_METADATA,
		};
		fetchMock
			.mockResolvedValueOnce(
				new Response(JSON.stringify({ agendas: "agenda" }), { status: 200 }),
			)
			.mockResolvedValueOnce(
				new Response(JSON.stringify([{ word: 1 }]), { status: 200 }),
			);

		await expect(loadDictionarySeedAssets(manifest)).rejects.toThrow();
	});
});
