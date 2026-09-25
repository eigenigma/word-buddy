import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
	DICTIONARY_META_PUBLIC_PATH,
	DICTIONARY_PUBLIC_DIRECTORY,
	dictShardPublicPath,
	LEMMA_INDEX_PUBLIC_PATH,
} from "../src/shared/dictionary/assetPaths";
import type {
	DictionaryBuildOutputCounts,
	DictionaryEntry,
} from "../src/shared/dictionary/types";
import { toErrorMessage } from "../src/shared/utils/errors";
import {
	buildDictionaryEntries,
	buildLemmaIndex,
	countLemmaRows,
	createDictionaryBuildMetadata,
	parseEcdictCsv,
} from "./dict/pipeline";

const RAW_ECDICT_URL = new URL("../data/raw/ecdict.csv", import.meta.url);
const RAW_LEMMA_URL = new URL("../data/raw/lemma.en.txt", import.meta.url);
const PUBLIC_DIRECTORY_URL = new URL("../public/", import.meta.url);

const DICT_SHARD_BYTE_LIMIT = 4 * 1024 * 1024;

function publicFileUrl(publicPath: string): URL {
	return new URL(`.${publicPath}`, PUBLIC_DIRECTORY_URL);
}

function sha256(content: string): string {
	return createHash("sha256").update(content).digest("hex");
}

async function readRequiredTextFile(fileUrl: URL): Promise<string> {
	try {
		return await readFile(fileUrl, "utf8");
	} catch (error) {
		const filePath = fileURLToPath(fileUrl);

		throw new Error(
			`Missing required dictionary source file: ${filePath}. Put the raw ECDict files in data/raw/ and rerun bun run build:dict. Original error: ${toErrorMessage(error)}`,
		);
	}
}

function serializeJson(value: unknown, pretty = false): string {
	return `${JSON.stringify(value, null, pretty ? 2 : undefined)}\n`;
}

function splitEntriesIntoShards(
	entries: readonly DictionaryEntry[],
): readonly (readonly DictionaryEntry[])[] {
	if (entries.length === 0) {
		return [[]];
	}

	const shards: DictionaryEntry[][] = [[]];
	let currentShardBytes = 2;

	for (const entry of entries) {
		const entryBytes = Buffer.byteLength(JSON.stringify(entry), "utf8");
		const lastShardIndex = shards.length - 1;
		const lastShard = shards[lastShardIndex];
		if (!lastShard) {
			throw new Error("shards array lost its tail unexpectedly");
		}

		const projectedBytes = currentShardBytes + entryBytes + 1;
		if (lastShard.length > 0 && projectedBytes > DICT_SHARD_BYTE_LIMIT) {
			shards.push([entry]);
			currentShardBytes = 2 + entryBytes + 1;
			continue;
		}

		lastShard.push(entry);
		currentShardBytes = projectedBytes;
	}

	return shards;
}

// The build owns the whole directory, so clearing it drops any file a
// previous build wrote under a name this one no longer produces.
async function writeArtifacts(
	dictShards: readonly (readonly DictionaryEntry[])[],
	lemmaIndex: unknown,
	metadata: unknown,
): Promise<void> {
	const outputDirectoryUrl = publicFileUrl(DICTIONARY_PUBLIC_DIRECTORY);
	await rm(outputDirectoryUrl, { force: true, recursive: true });
	await mkdir(outputDirectoryUrl, { recursive: true });
	await Promise.all([
		...dictShards.map(
			(shard, index): Promise<void> =>
				writeFile(
					publicFileUrl(dictShardPublicPath(index)),
					serializeJson(shard),
				),
		),
		writeFile(
			publicFileUrl(LEMMA_INDEX_PUBLIC_PATH),
			serializeJson(lemmaIndex),
		),
		writeFile(
			publicFileUrl(DICTIONARY_META_PUBLIC_PATH),
			serializeJson(metadata, true),
		),
	]);
}

async function main(): Promise<void> {
	const [ecdictText, lemmaText] = await Promise.all([
		readRequiredTextFile(RAW_ECDICT_URL),
		readRequiredTextFile(RAW_LEMMA_URL),
	]);
	const parsedRows = parseEcdictCsv(ecdictText);
	const dictionaryBuild = buildDictionaryEntries(parsedRows);
	const lemmaBuild = buildLemmaIndex(
		parsedRows,
		dictionaryBuild.wordSet,
		lemmaText,
	);
	const dictShards = splitEntriesIntoShards(dictionaryBuild.entries);
	const outputCounts: DictionaryBuildOutputCounts = {
		dictEntries: dictionaryBuild.entries.length,
		duplicateDictEntriesDiscarded:
			dictionaryBuild.counts.duplicateDictEntriesDiscarded,
		lemmaConflictsSkipped: lemmaBuild.counts.lemmaConflictsSkipped,
		lemmaEntries: lemmaBuild.counts.lemmaEntries,
		lemmaExchangeMappings: lemmaBuild.counts.lemmaExchangeMappings,
		lemmaPrimaryMappings: lemmaBuild.counts.lemmaPrimaryMappings,
		lemmaSelfMappings: lemmaBuild.counts.lemmaSelfMappings,
		lemmaSkippedMissingDictionary:
			lemmaBuild.counts.lemmaSkippedMissingDictionary,
		rejectedRows: dictionaryBuild.counts.rejectedRows,
	};
	const metadata = createDictionaryBuildMetadata(
		parsedRows.length,
		countLemmaRows(lemmaText),
		sha256(ecdictText),
		sha256(lemmaText),
		outputCounts,
		dictShards.length,
	);

	await writeArtifacts(dictShards, lemmaBuild.index, metadata);
	process.stdout.write(
		`Generated ${dictionaryBuild.entries.length} dictionary entries across ${dictShards.length} shard(s) and ${lemmaBuild.counts.lemmaEntries} lemma mappings.\n`,
	);
}

await main();
