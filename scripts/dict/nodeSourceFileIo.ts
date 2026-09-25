import { mkdir, readFile, writeFile } from "node:fs/promises";

import type { SourceFileIo } from "./sourceFiles";

function isMissingFileError(error: unknown): boolean {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
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
			await mkdir(new URL(".", fileUrl), { recursive: true });
			await writeFile(fileUrl, content);
		},
	};
}
