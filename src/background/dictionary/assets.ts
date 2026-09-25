import type { PublicPath } from "wxt/browser";
import { z } from "zod";

import {
	DICTIONARY_META_PUBLIC_PATH,
	dictShardPublicPath,
	LEMMA_INDEX_PUBLIC_PATH,
} from "@/shared/dictionary/assetPaths";
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

export interface DictionarySeedAssets extends DictionarySeedManifest {
	readonly dictEntries: readonly DictionaryEntry[];
	readonly lemmaEntries: readonly LemmaEntry[];
}

export interface DictionaryAssetLoaderDependencies {
	readonly fetch: (url: string) => Promise<Response>;
	readonly getUrl: (assetPath: PublicPath) => string;
}

export interface DictionaryAssetLoader {
	readonly loadAssets: (
		manifest: DictionarySeedManifest,
	) => Promise<DictionarySeedAssets>;
	readonly loadManifest: () => Promise<DictionarySeedManifest>;
}

const DictionaryEntrySchema: z.ZodType<DictionaryEntry> = z
	.object({
		definition: z.string().nullable(),
		frequency: z
			.object({
				bnc: z.number().nullable(),
				collins: z.number().nullable(),
				frq: z.number().nullable(),
				oxford: z.boolean(),
				tags: z.array(z.string()).readonly(),
			})
			.readonly(),
		morphology: z
			.object({
				exchange: z.record(z.string(), z.string()).readonly(),
			})
			.readonly(),
		phonetic: z.string().nullable(),
		pos: z.string().nullable(),
		translation: z.string().nullable(),
		word: z.string(),
	})
	.readonly();

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
				lemmaSelfMappings: z.number(),
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

	const loadLemmaIndex = async (): Promise<LemmaIndex> =>
		LemmaIndexSchema.parse(
			JSON.parse(await fetchAssetText(LEMMA_INDEX_PUBLIC_PATH)),
		);

	const loadDictShard = async (
		index: number,
	): Promise<readonly DictionaryEntry[]> =>
		DictionaryEntryArraySchema.parse(
			JSON.parse(await fetchAssetText(dictShardPublicPath(index))),
		);

	return {
		loadAssets: async (
			manifest: DictionarySeedManifest,
		): Promise<DictionarySeedAssets> => {
			const [lemmaIndex, dictShards] = await Promise.all([
				loadLemmaIndex(),
				Promise.all(
					manifest.metadata.artifactSha256.dictShards.map(
						(_, index: number): Promise<readonly DictionaryEntry[]> =>
							loadDictShard(index),
					),
				),
			]);

			return {
				assetFingerprint: manifest.assetFingerprint,
				dictEntries: dictShards.flat(),
				lemmaEntries: toLemmaEntries(lemmaIndex),
				metadata: manifest.metadata,
			};
		},
		loadManifest: async (): Promise<DictionarySeedManifest> => {
			const metadataText = await fetchAssetText(DICTIONARY_META_PUBLIC_PATH);
			const metadata = DictionaryBuildMetadataSchema.parse(
				JSON.parse(metadataText),
			);

			return {
				assetFingerprint: await sha256HexOfText(metadataText),
				metadata: metadata,
			};
		},
	};
}
