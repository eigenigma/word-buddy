export interface WordbookEntry {
	readonly addedAt: number;
	readonly context: string | null;
	readonly lemma: string;
	readonly original: string;
	readonly sourceUrl: string | null;
}

export interface WordbookUpdatePatch {
	readonly context?: string | null;
	readonly original?: string;
}
