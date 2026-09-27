import { execFileSync } from "node:child_process";
import {
	copyFile,
	mkdir,
	mkdtempDisposable,
	readdir,
	rename,
	rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { createNodeSourceFileCopier } from "./dict/nodeSourceFileIo";
import { copyDictionarySources } from "./dict/sourceFiles";
import { DICTIONARY_SOURCES } from "./dict/sources";
import { REPOSITORY_ROOT_URL } from "./repositoryRoot";

const REPOSITORY_ROOT = fileURLToPath(REPOSITORY_ROOT_URL);
const OUTPUT_DIRECTORY = ".output";
// submit:firefox in package.json reads these two paths literally.
const RELEASE_PATH = join(OUTPUT_DIRECTORY, "release");
const RELEASE_DIRECTORY = join(REPOSITORY_ROOT, RELEASE_PATH);
const EXTENSION_ZIP_NAME = "extension.zip";
const SOURCES_ZIP_NAME = "sources.zip";

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

async function buildFromSources(
	sourcesZipPath: string,
	buildRoot: string,
): Promise<void> {
	run(buildRoot, "unzip", ["-q", sourcesZipPath, "-d", buildRoot]);
	await copyDictionarySources(
		Object.values(DICTIONARY_SOURCES),
		createNodeSourceFileCopier(
			REPOSITORY_ROOT_URL,
			pathToFileURL(`${buildRoot}/`),
		),
	);
	run(buildRoot, "bun", ["install", "--frozen-lockfile"]);
	run(buildRoot, "bun", ["run", "dict"]);
	run(buildRoot, "bun", ["run", "zip"]);
}

// WXT names the XPI, and a fresh build writes no other zip.
async function findExtensionZip(outputDirectory: string): Promise<string> {
	const zipNames = (await readdir(outputDirectory)).filter(
		(fileName: string): boolean => fileName.endsWith(".zip"),
	);
	const [zipName] = zipNames;
	if (zipName === undefined || zipNames.length > 1) {
		throw new Error(
			`Expected one zip in ${outputDirectory}, found: ${zipNames.join(", ")}`,
		);
	}

	return join(outputDirectory, zipName);
}

async function main(): Promise<void> {
	await rm(RELEASE_DIRECTORY, { force: true, recursive: true });
	assertCleanWorkingTree();

	// The pair is assembled beside release/ and lands there in one rename, so a
	// failed run leaves release/ absent rather than half-filled.
	await mkdir(dirname(RELEASE_DIRECTORY), { recursive: true });
	await using staging = await mkdtempDisposable(`${RELEASE_DIRECTORY}-`);
	const sourcesZipPath = join(staging.path, SOURCES_ZIP_NAME);
	run(REPOSITORY_ROOT, "git", [
		"archive",
		"--format=zip",
		`--output=${sourcesZipPath}`,
		"HEAD",
	]);

	await using buildRoot = await mkdtempDisposable(
		join(tmpdir(), "word-buddy-package-"),
	);
	await buildFromSources(sourcesZipPath, buildRoot.path);
	const builtExtensionZip = await findExtensionZip(
		join(buildRoot.path, OUTPUT_DIRECTORY),
	);
	await copyFile(builtExtensionZip, join(staging.path, EXTENSION_ZIP_NAME));
	await rename(staging.path, RELEASE_DIRECTORY);

	process.stdout.write(
		`${join(RELEASE_PATH, EXTENSION_ZIP_NAME)}\n${join(RELEASE_PATH, SOURCES_ZIP_NAME)}\n`,
	);
}

await main();
