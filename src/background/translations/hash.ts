import { compareCodePoints } from "@/shared/utils/compare";
import { sha256HexOfText } from "@/shared/utils/hash";

const HASH_SEPARATOR = "\u001f";

export async function computeTranslationHash(
	model: string,
	paragraph: string,
	words: readonly string[],
): Promise<string> {
	const sortedWords = words.toSorted(compareCodePoints);
	const payload = [model, paragraph, sortedWords.join(HASH_SEPARATOR)].join(
		HASH_SEPARATOR,
	);

	return await sha256HexOfText(payload);
}
