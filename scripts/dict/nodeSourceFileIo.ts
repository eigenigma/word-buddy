import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

import type {
	SourceCopyResult,
	SourceFileCopier,
	SourceFileIo,
} from "./sourceFiles";

function isMissingFileError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}

async function ensureParentDirectory(fileUrl: URL): Promise<void> {
	await mkdir(new URL(".", fileUrl), { recursive: true });
}

export function createNodeSourceFileIo(repositoryRoot: URL): SourceFileIo {
	return {
		download: async (url: string): Promise<Uint8Array> => {
			const response = await fetch(url);
			if (!response.ok) {
				throw new Error(`Failed to download ${url}: ${response.status}`);
			}

			return new Uint8Array(await response.arrayBuffer());
		},
		read: async (path: string): Promise<Uint8Array | null> => {
			try {
				return await readFile(new URL(path, repositoryRoot));
			} catch (error) {
				if (isMissingFileError(error)) {
					return null;
				}

				throw error;
			}
		},
		write: async (path: string, content: Uint8Array): Promise<void> => {
			const fileUrl = new URL(path, repositoryRoot);
			await ensureParentDirectory(fileUrl);
			await writeFile(fileUrl, content);
		},
	};
}

export function createNodeSourceFileCopier(
	fromRoot: URL,
	toRoot: URL,
): SourceFileCopier {
	return async (path: string): Promise<SourceCopyResult> => {
		const targetUrl = new URL(path, toRoot);
		// With the target directory in place, ENOENT can only mean a missing
		// source.
		await ensureParentDirectory(targetUrl);
		try {
			await copyFile(new URL(path, fromRoot), targetUrl);
		} catch (error) {
			if (isMissingFileError(error)) {
				return "missing";
			}

			throw error;
		}

		return "copied";
	};
}
