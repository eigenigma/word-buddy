import { createNodeSourceFileIo } from "./dict/nodeSourceFileIo";
import { fetchSource } from "./dict/sourceFiles";
import { DICTIONARY_SOURCES, type DictionarySource } from "./dict/sources";
import { REPOSITORY_ROOT_URL } from "./repositoryRoot";

async function main(): Promise<void> {
	const io = createNodeSourceFileIo(REPOSITORY_ROOT_URL);
	const lines = await Promise.all(
		Object.values(DICTIONARY_SOURCES).map(
			async (source: DictionarySource): Promise<string> =>
				`${source.path}: ${await fetchSource(source, io)}\n`,
		),
	);

	process.stdout.write(lines.join(""));
}

await main();
