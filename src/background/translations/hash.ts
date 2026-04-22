import { sha256HexOfText } from "@/shared/utils/hash";

const HASH_SEPARATOR = "\u001f";

function compareStringsByCodePoint(left: string, right: string): number {
	const leftCodePoints = Array.from(left);
	const rightCodePoints = Array.from(right);
	const sharedLength = Math.min(leftCodePoints.length, rightCodePoints.length);

	for (let index = 0; index < sharedLength; index += 1) {
		const leftValue = leftCodePoints[index]?.codePointAt(0);
		const rightValue = rightCodePoints[index]?.codePointAt(0);

		if (leftValue === undefined || rightValue === undefined) {
			continue;
		}

		if (leftValue !== rightValue) {
			return leftValue - rightValue;
		}
	}

	return leftCodePoints.length - rightCodePoints.length;
}

export function sortWordsForHash(words: readonly string[]): readonly string[] {
	return [...words].sort(compareStringsByCodePoint);
}

export async function computeTranslationHash(
	model: string,
	paragraph: string,
	words: readonly string[],
): Promise<string> {
	const sortedWords = sortWordsForHash(words);
	const payload = [model, paragraph, sortedWords.join(HASH_SEPARATOR)].join(
		HASH_SEPARATOR,
	);

	return await sha256HexOfText(payload);
}
