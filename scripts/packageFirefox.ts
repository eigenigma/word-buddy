import { execFileSync } from "node:child_process";
import {
	copyFile,
	mkdir,
	mkdtempDisposable,
	readdir,
	readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { z } from "zod";

import { createNodeSourceFileIo } from "./dict/nodeSourceFileIo";
import type { SourceFileIo } from "./dict/sourceFiles";
import { DICTIONARY_SOURCES, type DictionarySource } from "./dict/sources";

const REPOSITORY_ROOT_URL = new URL("../", import.meta.url);
const REPOSITORY_ROOT = fileURLToPath(REPOSITORY_ROOT_URL);
const OUTPUT_DIRECTORY = ".output";

const packageManifestSchema = z.object({
	name: z.string().min(1),
	version: z.string().min(1),
});

type PackageManifest = z.infer<typeof packageManifestSchema>;

function run(cwd: string, command: string, args: readonly string[]): void {
	execFileSync(command, args, { cwd: cwd, stdio: "inherit" });
}

function assertCleanWorkingTree(): void {
	const status = execFileSync("git", ["status", "--porcelain"], {
		cwd: REPOSITORY_ROOT,
		encoding: "utf8",
	});
	if (status.length > 0) {
		throw new Error(
			`Packaging builds from HEAD, so the working tree must be clean:\n${status}`,
		);
	}
}

async function readPackageManifest(): Promise<PackageManifest> {
	const text = await readFile(join(REPOSITORY_ROOT, "package.json"), "utf8");
	return packageManifestSchema.parse(JSON.parse(text));
}

// Saves a download when the raw sources are already here; fetch:dict still
// verifies every copied file against its pinned hash.
async function copyDictionarySources(
	from: SourceFileIo,
	to: SourceFileIo,
): Promise<void> {
	await Promise.all(
		Object.values(DICTIONARY_SOURCES).map(
			async (source: DictionarySource): Promise<void> => {
				const content = await from.read(source.path);
				if (content !== null) {
					await to.write(source.path, content);
				}
			},
		),
	);
}

async function buildFromSources(
	sourcesZipPath: string,
	buildRoot: string,
): Promise<void> {
	run(buildRoot, "unzip", ["-q", sourcesZipPath, "-d", buildRoot]);
	await copyDictionarySources(
		createNodeSourceFileIo(REPOSITORY_ROOT_URL),
		createNodeSourceFileIo(pathToFileURL(`${buildRoot}/`)),
	);
	run(buildRoot, "bun", ["install", "--frozen-lockfile"]);
	run(buildRoot, "bun", ["run", "fetch:dict"]);
	run(buildRoot, "bun", ["run", "build:dict"]);
	run(buildRoot, "bun", ["run", "zip"]);
}

// WXT names the XPI, and a fresh build writes no other zip.
async function findExtensionZipName(outputDirectory: string): Promise<string> {
	const zipNames = (await readdir(outputDirectory)).filter(
		(fileName: string): boolean => fileName.endsWith(".zip"),
	);
	const [zipName] = zipNames;
	if (zipName === undefined || zipNames.length > 1) {
		throw new Error(
			`Expected one zip in ${outputDirectory}, found: ${zipNames.join(", ")}`,
		);
	}

	return zipName;
}

async function main(): Promise<void> {
	assertCleanWorkingTree();

	const { name, version } = await readPackageManifest();
	const outputDirectory = join(REPOSITORY_ROOT, OUTPUT_DIRECTORY);
	const sourcesZipName = `${name}-${version}-sources.zip`;
	const sourcesZipPath = join(outputDirectory, sourcesZipName);

	await mkdir(outputDirectory, { recursive: true });
	run(REPOSITORY_ROOT, "git", [
		"archive",
		"--format=zip",
		`--output=${sourcesZipPath}`,
		"HEAD",
	]);

	await using buildRoot = await mkdtempDisposable(
		join(tmpdir(), `${name}-package-`),
	);
	await buildFromSources(sourcesZipPath, buildRoot.path);
	const buildOutputDirectory = join(buildRoot.path, OUTPUT_DIRECTORY);
	const extensionZipName = await findExtensionZipName(buildOutputDirectory);
	await copyFile(
		join(buildOutputDirectory, extensionZipName),
		join(outputDirectory, extensionZipName),
	);

	process.stdout.write(
		`${join(OUTPUT_DIRECTORY, extensionZipName)}\n${join(OUTPUT_DIRECTORY, sourcesZipName)}\n`,
	);
}

await main();
