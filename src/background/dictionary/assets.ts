import type { PublicPath } from "wxt/browser";
import { z } from "zod";

import {
	DICTIONARY_META_PUBLIC_PATH,
	dictShardPublicPath,
	LEMMA_INDEX_PUBLIC_PATH,
} from "@/shared/dictionary/assetPaths";
import { DictionaryEntrySchema } from "@/shared/dictionary/schemas";
import {
	DICTIONARY_METADATA_SCHEMA_VERSION,
	type DictionaryBuildMetadata,
	type DictionaryEntry,
	type LemmaEntry,
	type LemmaIndex,
} from "@/shared/dictionary/types";
import { sha256HexOfText } from "@/shared/utils/hash";

export interface DictionarySeedManifest {
	readonly assetFingerprint: string;
	readonly metadata: DictionaryBuildMetadata;
}

// The manifest fingerprint covers the generated artifacts. Bump this when the
// rows this loader produces (schemas, toLemmaEntries) change shape for the
// same artifacts, so installed dictionaries reseed.
export const SEED_FORMAT_VERSION = 2;

export interface DictionaryAssetLoaderDependencies {
	readonly fetch: (url: string) => Promise<Response>;
	readonly getUrl: (assetPath: PublicPath) => string;
}

export interface DictionaryAssetLoader {
	// Each shard is fetched and parsed only when the consumer asks for it.
	readonly loadDictShards: (
		manifest: DictionarySeedManifest,
	) => AsyncIterable<readonly DictionaryEntry[]>;
	readonly loadLemmaEntries: () => Promise<readonly LemmaEntry[]>;
	readonly loadManifest: () => Promise<DictionarySeedManifest>;
}

const DictionaryEntryArraySchema = z.array(DictionaryEntrySchema).readonly();

const LemmaIndexSchema: z.ZodType<LemmaIndex> = z
	.record(z.string(), z.string())
	.readonly();

const DictionaryBuildMetadataSchema: z.ZodType<DictionaryBuildMetadata> = z
	.object({
		artifactSha256: z
			.object({
				dictShards: z.array(z.string()).readonly(),
				lemmaIndex: z.string(),
			})
			.readonly(),
		filterPolicy: z
			.object({
				lexicalWordPattern: z.string(),
				requireMeaning: z.boolean(),
				requireQualitySignal: z.array(z.string()).readonly(),
				retainLowercaseHeadwordsOnly: z.boolean(),
			})
			.readonly(),
		outputs: z
			.object({
				dictEntries: z.number(),
				lemmaConflictsSkipped: z.number(),
				lemmaExchangeMappings: z.number(),
				lemmaEntries: z.number(),
				lemmaPrimaryMappings: z.number(),
				lemmaSkippedMissingDictionary: z.number(),
				rejectedRows: z
					.object({
						duplicateWord: z.number(),
						emptyMeaning: z.number(),
						nonLexicalWord: z.number(),
						weakSignal: z.number(),
					})
					.readonly(),
			})
			.readonly(),
		schemaVersion: z.literal(DICTIONARY_METADATA_SCHEMA_VERSION),
		sources: z
			.object({
				ecdict: z
					.object({
						rowCount: z.number(),
						sha256: z.string(),
					})
					.readonly(),
				lemma: z
					.object({
						rowCount: z.number(),
						sha256: z.string(),
					})
					.readonly(),
			})
			.readonly(),
	})
	.readonly();

function toLemmaEntries(lemmaIndex: LemmaIndex): readonly LemmaEntry[] {
	return Object.entries(lemmaIndex).map(
		([surface, lemma]): LemmaEntry => ({
			lemma: lemma,
			surface: surface,
		}),
	);
}

export function createDictionaryAssetLoader(
	dependencies: DictionaryAssetLoaderDependencies,
): DictionaryAssetLoader {
	const fetchAssetText = async (assetPath: PublicPath): Promise<string> => {
		const response = await dependencies.fetch(dependencies.getUrl(assetPath));

		if (!response.ok) {
			throw new Error(
				`Failed to load dictionary asset ${assetPath}: ${response.status}`,
			);
		}

		return await response.text();
	};

	const fetchJsonAsset = async <T>(
		assetPath: PublicPath,
		schema: z.ZodType<T>,
	): Promise<T> => schema.parse(JSON.parse(await fetchAssetText(assetPath)));

	return {
		loadDictShards: async function* (
			manifest: DictionarySeedManifest,
		): AsyncGenerator<readonly DictionaryEntry[]> {
			for (const shardIndex of manifest.metadata.artifactSha256.dictShards.keys()) {
				yield await fetchJsonAsset(
					dictShardPublicPath(shardIndex),
					DictionaryEntryArraySchema,
				);
			}
		},
		loadLemmaEntries: async (): Promise<readonly LemmaEntry[]> =>
			toLemmaEntries(
				await fetchJsonAsset(LEMMA_INDEX_PUBLIC_PATH, LemmaIndexSchema),
			),
		loadManifest: async (): Promise<DictionarySeedManifest> => {
			const metadataText = await fetchAssetText(DICTIONARY_META_PUBLIC_PATH);

			return {
				assetFingerprint: await sha256HexOfText(metadataText),
				metadata: DictionaryBuildMetadataSchema.parse(JSON.parse(metadataText)),
			};
		},
	};
}
