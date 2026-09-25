export const DICTIONARY_PUBLIC_DIRECTORY = "/data/";
const DICT_SHARD_FILE_PREFIX = "dict-";
const JSON_FILE_EXTENSION = ".json";

export const DICTIONARY_META_PUBLIC_PATH =
	`${DICTIONARY_PUBLIC_DIRECTORY}dict-meta.json` as const;
export const LEMMA_INDEX_PUBLIC_PATH =
	`${DICTIONARY_PUBLIC_DIRECTORY}lemma-index.json` as const;

// WXT pastes this into its generated PublicPath type, so `${number}` must stay
// unevaluated.
export const DICT_SHARD_PUBLIC_PATH_TEMPLATE = `${DICTIONARY_PUBLIC_DIRECTORY}${DICT_SHARD_FILE_PREFIX}\${number}${JSON_FILE_EXTENSION}`;

export function dictShardPublicPath(
	index: number,
): `${typeof DICTIONARY_PUBLIC_DIRECTORY}${typeof DICT_SHARD_FILE_PREFIX}${number}${typeof JSON_FILE_EXTENSION}` {
	return `${DICTIONARY_PUBLIC_DIRECTORY}${DICT_SHARD_FILE_PREFIX}${index}${JSON_FILE_EXTENSION}`;
}
