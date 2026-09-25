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

async function fetchAssetText(assetPath: PublicPath): Promise<string> {
	const assetUrl = browser.runtime.getURL(assetPath);
	const response = await fetch(assetUrl);

	if (!response.ok) {
		throw new Error(
			`Failed to load dictionary asset ${assetPath}: ${response.status}`,
		);
	}

	return await response.text();
}

export async function loadDictionarySeedManifest(): Promise<DictionarySeedManifest> {
	const metadataText = await fetchAssetText(DICTIONARY_META_PUBLIC_PATH);
	const metadata = DictionaryBuildMetadataSchema.parse(
		JSON.parse(metadataText),
	);

	return {
		assetFingerprint: await sha256HexOfText(metadataText),
		metadata: metadata,
	};
}

export async function loadDictionarySeedAssets(
	manifest: DictionarySeedManifest,
): Promise<DictionarySeedAssets> {
	const [lemmaText, ...shardTexts] = await Promise.all([
		fetchAssetText(LEMMA_INDEX_PUBLIC_PATH),
		...manifest.metadata.artifactSha256.dictShards.map(
			(_, index: number): Promise<string> =>
				fetchAssetText(dictShardPublicPath(index)),
		),
	]);
	if (lemmaText === undefined) {
		throw new Error("failed to load lemma asset");
	}
	const dictEntries = shardTexts.flatMap(
		(text: string): readonly DictionaryEntry[] =>
			DictionaryEntryArraySchema.parse(JSON.parse(text)),
	);
	const lemmaIndex = LemmaIndexSchema.parse(JSON.parse(lemmaText));

	return {
		assetFingerprint: manifest.assetFingerprint,
		dictEntries: dictEntries,
		lemmaEntries: toLemmaEntries(lemmaIndex),
		metadata: manifest.metadata,
	};
}
