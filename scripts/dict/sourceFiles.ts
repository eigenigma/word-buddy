import type { DictionarySource } from "./sources";
import { sha256Hex } from "./utils";

export interface SourceFileIo {
	readonly download: (url: string) => Promise<Uint8Array>;
	readonly read: (path: string) => Promise<Uint8Array | null>;
	readonly write: (path: string, content: Uint8Array) => Promise<void>;
}

type SourceFileCheck =
	| { readonly kind: "invalid"; readonly problem: string }
	| { readonly content: Uint8Array; readonly kind: "verified" };

function describeHashMismatch(
	source: DictionarySource,
	content: Uint8Array,
): string | null {
	const actualSha256 = sha256Hex(content);

	return actualSha256 === source.sha256
		? null
		: `has sha256 ${actualSha256}, expected ${source.sha256}`;
}

async function checkSourceFile(
	source: DictionarySource,
	io: SourceFileIo,
): Promise<SourceFileCheck> {
	const content = await io.read(source.path);
	if (content === null) {
		return { kind: "invalid", problem: "is missing" };
	}

	const mismatch = describeHashMismatch(source, content);
	if (mismatch !== null) {
		return { kind: "invalid", problem: mismatch };
	}

	return { content: content, kind: "verified" };
}

export async function readVerifiedSource(
	source: DictionarySource,
	io: SourceFileIo,
): Promise<Uint8Array> {
	const check = await checkSourceFile(source, io);
	if (check.kind === "verified") {
		return check.content;
	}

	throw new Error(
		`${source.path} ${check.problem}. Run bun run fetch:dict to download the pinned version.`,
	);
}

export async function fetchSource(
	source: DictionarySource,
	io: SourceFileIo,
): Promise<"downloaded" | "verified"> {
	const check = await checkSourceFile(source, io);
	if (check.kind === "verified") {
		return "verified";
	}

	const content = await io.download(source.url);
	const mismatch = describeHashMismatch(source, content);
	if (mismatch !== null) {
		throw new Error(`${source.url} ${mismatch}.`);
	}

	await io.write(source.path, content);
	return "downloaded";
}
