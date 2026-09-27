import {
	mkdir,
	mkdtempDisposable,
	readFile,
	writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { createNodeSourceFileCopier } from "./nodeSourceFileIo";
import type { SourceFileCopier } from "./sourceFiles";

const SOURCE_PATH = "data/raw/sample.txt";

function createTempRoot(): Promise<
	AsyncDisposable & { readonly path: string }
> {
	return mkdtempDisposable(join(tmpdir(), "word-buddy-copier-"));
}

function copierWithin(root: string): SourceFileCopier {
	return createNodeSourceFileCopier(
		pathToFileURL(join(root, "from/")),
		pathToFileURL(join(root, "to/")),
	);
}

describe("createNodeSourceFileCopier", () => {
	it("copies a file and creates the target's parent directories", async () => {
		await using root = await createTempRoot();
		await mkdir(join(root.path, "from/data/raw"), { recursive: true });
		await writeFile(join(root.path, "from", SOURCE_PATH), "pinned\n");

		await expect(copierWithin(root.path)(SOURCE_PATH)).resolves.toBe("copied");
		await expect(
			readFile(join(root.path, "to", SOURCE_PATH), "utf8"),
		).resolves.toBe("pinned\n");
	});

	it("reports a missing source as missing", async () => {
		await using root = await createTempRoot();

		await expect(copierWithin(root.path)(SOURCE_PATH)).resolves.toBe("missing");
	});

	it("propagates errors other than a missing source", async () => {
		await using root = await createTempRoot();
		await mkdir(join(root.path, "from", SOURCE_PATH), { recursive: true });

		await expect(copierWithin(root.path)(SOURCE_PATH)).rejects.toThrow();
	});
});
