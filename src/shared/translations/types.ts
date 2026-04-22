export interface TranslationCacheEntry {
	readonly createdAt: number;
	readonly hash: string;
	readonly model: string;
	readonly paragraph: string;
	readonly translations: Readonly<Record<string, string>>;
	readonly words: readonly string[];
}
