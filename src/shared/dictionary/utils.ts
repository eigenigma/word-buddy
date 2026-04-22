const LEXICAL_WORD_PATTERN = /^[a-z]+(?:['-][a-z]+)*$/u;
export const LOOKUP_TERM_PATTERN =
	/^[a-z]+(?:['-][a-z]+)*(?: [a-z]+(?:['-][a-z]+)*)*$/u;

export function normalizeWord(value: string): string | null {
	const normalizedValue = value.trim().toLowerCase();

	if (!normalizedValue) {
		return null;
	}

	if (!LEXICAL_WORD_PATTERN.test(normalizedValue)) {
		return null;
	}

	return normalizedValue;
}

export function normalizeLookupTerm(value: string): string | null {
	const normalizedValue = value.trim().toLowerCase().replaceAll(/\s+/gu, " ");

	if (!normalizedValue) {
		return null;
	}

	if (!LOOKUP_TERM_PATTERN.test(normalizedValue)) {
		return null;
	}

	return normalizedValue;
}
