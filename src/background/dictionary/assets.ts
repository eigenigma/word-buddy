import type { PublicPath } from "wxt/browser";
import { z } from "zod";

import type {
	DictionaryBuildMetadata,
	DictionaryEntry,
	LemmaEntry,
	LemmaIndex,
} from "@/shared/dictionary/types";
import { sha256HexOfText } from "@/shared/utils/hash";

const LEMMA_ASSET_PATH = "/data/lemma-index.json" as const;
const META_ASSET_PATH = "/data/dict-meta.json" as const;

function dictShardAssetPath(index: number): PublicPath {
	return `/data/dict-${index}.json` as PublicPath;
}

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
		dictShardCount: z.number().int().nonnegative(),
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
				duplicateDictEntriesDiscarded: z.number(),
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
		schemaVersion: z.literal(1),
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

function parseJsonText(text: string): unknown {
	return JSON.parse(text) as unknown;
}

export async function loadDictionarySeedManifest(): Promise<DictionarySeedManifest> {
	const metadataText = await fetchAssetText(META_ASSET_PATH);
	const metadata = DictionaryBuildMetadataSchema.parse(
		parseJsonText(metadataText),
	);

	return {
		assetFingerprint: await sha256HexOfText(metadataText),
		metadata: metadata,
	};
}

export async function loadDictionarySeedAssets(
	manifest: DictionarySeedManifest,
): Promise<DictionarySeedAssets> {
	const { dictShardCount } = manifest.metadata;
	const [lemmaText, ...shardTexts] = await Promise.all([
		fetchAssetText(LEMMA_ASSET_PATH),
		...Array.from(
			{ length: dictShardCount },
			(_, index: number): Promise<string> =>
				fetchAssetText(dictShardAssetPath(index)),
		),
	]);
	if (lemmaText === undefined) {
		throw new Error("failed to load lemma asset");
	}
	const dictEntries = shardTexts.flatMap(
		(text: string): readonly DictionaryEntry[] =>
			DictionaryEntryArraySchema.parse(parseJsonText(text)),
	);
	const lemmaIndex = LemmaIndexSchema.parse(parseJsonText(lemmaText));

	return {
		assetFingerprint: manifest.assetFingerprint,
		dictEntries: dictEntries,
		lemmaEntries: toLemmaEntries(lemmaIndex),
		metadata: manifest.metadata,
	};
}
