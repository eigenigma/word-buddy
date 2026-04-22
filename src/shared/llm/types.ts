export interface TranslateParagraphInput {
	readonly paragraph: string;
	readonly words: readonly string[];
}

export type TranslationMap = Readonly<Record<string, string>>;

export interface TranslateParagraphResult {
	readonly cached: boolean;
	readonly translations: TranslationMap;
}
