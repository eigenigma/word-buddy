import { mkdir, rm, writeFile } from "node:fs/promises";

import {
	DICTIONARY_META_PUBLIC_PATH,
	DICTIONARY_PUBLIC_DIRECTORY,
	dictShardPublicPath,
	LEMMA_INDEX_PUBLIC_PATH,
} from "../src/shared/dictionary/assetPaths";
import type { DictionaryEntry } from "../src/shared/dictionary/types";
import { createNodeSourceFileIo } from "./dict/nodeSourceFileIo";
import {
	buildDictionaryEntries,
	buildLemmaIndex,
	countLemmaRows,
	createDictionaryBuildMetadata,
	parseEcdictCsv,
} from "./dict/pipeline";
import { readVerifiedSource, type SourceFileIo } from "./dict/sourceFiles";
import { DICTIONARY_SOURCES, type DictionarySource } from "./dict/sources";
import { sha256Hex } from "./dict/utils";

const REPOSITORY_ROOT_URL = new URL("../", import.meta.url);
const PUBLIC_DIRECTORY_URL = new URL("public/", REPOSITORY_ROOT_URL);

const DICT_SHARD_BYTE_LIMIT = 4 * 1024 * 1024;

interface SerializedArtifact {
	readonly publicPath: string;
	readonly text: string;
}

function publicFileUrl(publicPath: string): URL {
	return new URL(`.${publicPath}`, PUBLIC_DIRECTORY_URL);
}

async function readSourceText(
	source: DictionarySource,
	io: SourceFileIo,
): Promise<string> {
	return new TextDecoder().decode(await readVerifiedSource(source, io));
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
	artifacts: readonly SerializedArtifact[],
): Promise<void> {
	const outputDirectoryUrl = publicFileUrl(DICTIONARY_PUBLIC_DIRECTORY);
	await rm(outputDirectoryUrl, { force: true, recursive: true });
	await mkdir(outputDirectoryUrl, { recursive: true });
	await Promise.all(
		artifacts.map(
			(artifact: SerializedArtifact): Promise<void> =>
				writeFile(publicFileUrl(artifact.publicPath), artifact.text),
		),
	);
}

async function main(): Promise<void> {
	const io = createNodeSourceFileIo(REPOSITORY_ROOT_URL);
	const [ecdictText, lemmaText] = await Promise.all([
		readSourceText(DICTIONARY_SOURCES.ecdict, io),
		readSourceText(DICTIONARY_SOURCES.lemma, io),
	]);
	const parsedRows = parseEcdictCsv(ecdictText);
	const dictionaryBuild = buildDictionaryEntries(parsedRows);
	const lemmaBuild = buildLemmaIndex(
		parsedRows,
		dictionaryBuild.wordSet,
		lemmaText,
	);
	const shardArtifacts = splitEntriesIntoShards(dictionaryBuild.entries).map(
		(shard: readonly DictionaryEntry[], index: number): SerializedArtifact => ({
			publicPath: dictShardPublicPath(index),
			text: serializeJson(shard),
		}),
	);
	const lemmaIndexArtifact: SerializedArtifact = {
		publicPath: LEMMA_INDEX_PUBLIC_PATH,
		text: serializeJson(lemmaBuild.index),
	};
	const metadata = createDictionaryBuildMetadata({
		artifactSha256: {
			dictShards: shardArtifacts.map((artifact: SerializedArtifact): string =>
				sha256Hex(artifact.text),
			),
			lemmaIndex: sha256Hex(lemmaIndexArtifact.text),
		},
		dictionaryBuild: dictionaryBuild,
		lemmaBuild: lemmaBuild,
		sourceRowCounts: {
			ecdict: parsedRows.length,
			lemma: countLemmaRows(lemmaText),
		},
	});

	await writeArtifacts([
		...shardArtifacts,
		lemmaIndexArtifact,
		{
			publicPath: DICTIONARY_META_PUBLIC_PATH,
			text: serializeJson(metadata, true),
		},
	]);
	process.stdout.write(
		`Generated ${dictionaryBuild.entries.length} dictionary entries across ${shardArtifacts.length} shard(s) and ${lemmaBuild.counts.lemmaEntries} lemma mappings.\n`,
	);
}

await main();
