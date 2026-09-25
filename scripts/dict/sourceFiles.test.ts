import { describe, expect, it, type Mock, vi } from "vitest";

import {
	fetchSource,
	readVerifiedSource,
	type SourceFileIo,
} from "./sourceFiles";
import type { DictionarySource } from "./sources";
import { sha256Hex } from "./utils";

const PINNED_CONTENT = new TextEncoder().encode("pinned upstream content\n");
const TAMPERED_CONTENT = new TextEncoder().encode("tampered content\n");

const TEST_SOURCE: DictionarySource = {
	path: "data/raw/sample.txt",
	sha256: sha256Hex(PINNED_CONTENT),
	url: "https://example.test/sample.txt",
};

interface InMemorySourceFileIo extends SourceFileIo {
	readonly download: Mock<SourceFileIo["download"]>;
	readonly files: Map<string, Uint8Array>;
	readonly write: Mock<SourceFileIo["write"]>;
}

function createInMemoryIo(
	existing: Uint8Array | null,
	downloaded: Uint8Array,
): InMemorySourceFileIo {
	const files = new Map<string, Uint8Array>();
	if (existing) {
		files.set(TEST_SOURCE.path, existing);
	}

	return {
		download: vi.fn(
			(_url: string): Promise<Uint8Array> => Promise.resolve(downloaded),
		),
		files: files,
		read: (path: string): Promise<Uint8Array | null> =>
			Promise.resolve(files.get(path) ?? null),
		write: vi.fn((path: string, content: Uint8Array): Promise<void> => {
			files.set(path, content);
			return Promise.resolve();
		}),
	};
}

describe("readVerifiedSource", () => {
	it("returns the content when its hash matches the pinned sha256", async () => {
		const io = createInMemoryIo(PINNED_CONTENT, PINNED_CONTENT);

		await expect(readVerifiedSource(TEST_SOURCE, io)).resolves.toBe(
			PINNED_CONTENT,
		);
	});

	it("points at fetch:dict when the file is missing", async () => {
		const io = createInMemoryIo(null, PINNED_CONTENT);

		await expect(readVerifiedSource(TEST_SOURCE, io)).rejects.toThrow(
			"data/raw/sample.txt is missing. Run bun run fetch:dict",
		);
	});

	it("reports both hashes when the file does not match", async () => {
		const io = createInMemoryIo(TAMPERED_CONTENT, PINNED_CONTENT);

		await expect(readVerifiedSource(TEST_SOURCE, io)).rejects.toThrow(
			`data/raw/sample.txt has sha256 ${sha256Hex(TAMPERED_CONTENT)}, expected ${TEST_SOURCE.sha256}. Run bun run fetch:dict`,
		);
	});
});

describe("fetchSource", () => {
	it("skips the download when the existing file matches", async () => {
		const io = createInMemoryIo(PINNED_CONTENT, PINNED_CONTENT);

		await expect(fetchSource(TEST_SOURCE, io)).resolves.toBe("verified");
		expect(io.download).not.toHaveBeenCalled();
		expect(io.write).not.toHaveBeenCalled();
	});

	it("downloads a missing file", async () => {
		const io = createInMemoryIo(null, PINNED_CONTENT);

		await expect(fetchSource(TEST_SOURCE, io)).resolves.toBe("downloaded");
		expect(io.download).toHaveBeenCalledWith(TEST_SOURCE.url);
		expect(io.files.get(TEST_SOURCE.path)).toBe(PINNED_CONTENT);
	});

	it("replaces an existing file that does not match", async () => {
		const io = createInMemoryIo(TAMPERED_CONTENT, PINNED_CONTENT);

		await expect(fetchSource(TEST_SOURCE, io)).resolves.toBe("downloaded");
		expect(io.files.get(TEST_SOURCE.path)).toBe(PINNED_CONTENT);
	});

	it("rejects a download that does not match and leaves the file alone", async () => {
		const io = createInMemoryIo(null, TAMPERED_CONTENT);

		await expect(fetchSource(TEST_SOURCE, io)).rejects.toThrow(
			`${TEST_SOURCE.url} has sha256 ${sha256Hex(TAMPERED_CONTENT)}, expected ${TEST_SOURCE.sha256}.`,
		);
		expect(io.write).not.toHaveBeenCalled();
	});
});
