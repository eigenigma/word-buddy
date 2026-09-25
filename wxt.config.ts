import preact from "@preact/preset-vite";
import { defineConfig, type PublicPathEntry, type Wxt } from "wxt";

import {
	DICT_SHARD_PUBLIC_PATH_TEMPLATE,
	DICTIONARY_META_PUBLIC_PATH,
	LEMMA_INDEX_PUBLIC_PATH,
} from "./src/shared/dictionary/assetPaths";

export default defineConfig({
	srcDir: "src",
	modules: ["@wxt-dev/unocss"],
	unocss: {
		excludeEntrypoints: ["annotator", "background"],
	},
	hooks: {
		"prepare:publicPaths": (_wxt: Wxt, paths: PublicPathEntry[]): void => {
			paths.push(DICTIONARY_META_PUBLIC_PATH, LEMMA_INDEX_PUBLIC_PATH, {
				path: DICT_SHARD_PUBLIC_PATH_TEMPLATE,
				type: "templateLiteral",
			});
		},
	},
	manifest: {
		name: "Word Buddy",
		description:
			"Firefox vocabulary helper for English reading: inline glosses, click-to-lookup, and a personal wordbook.",
		homepage_url: "https://github.com/eigenigma/word-buddy",
		action: {
			default_title: "Word Buddy Settings",
		},
		permissions: ["storage", "activeTab", "tabs"],
		host_permissions: ["<all_urls>"],
		browser_specific_settings: {
			gecko: {
				data_collection_permissions: {
					required: ["none"],
				},
				id: "word-buddy@a322655.github.io",
			},
		},
	},
	vite: () => ({
		plugins: [preact()],
	}),
});
