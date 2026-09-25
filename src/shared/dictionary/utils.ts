const LEXICAL_WORD_PATTERN = /^[a-z]+(?:['-][a-z]+)*$/u;
export const LOOKUP_TERM_PATTERN =
	/^[a-z]+(?:['-][a-z]+)*(?: [a-z]+(?:['-][a-z]+)*)*$/u;

export function foldTermText(value: string): string {
	return value.trim().toLowerCase().replaceAll(/\s+/gu, " ");
}

function matchFoldedTerm(value: string, pattern: RegExp): string | null {
	const foldedValue = foldTermText(value);
	return pattern.test(foldedValue) ? foldedValue : null;
}

export function normalizeWord(value: string): string | null {
	return matchFoldedTerm(value, LEXICAL_WORD_PATTERN);
}

export function normalizeLookupTerm(value: string): string | null {
	return matchFoldedTerm(value, LOOKUP_TERM_PATTERN);
}
