import preact from "@preact/preset-vite";
import UnoCSS from "unocss/vite";
import type { InlineConfig } from "vite";
import {
	defineConfig,
	type Entrypoint,
	type PublicPathEntry,
	type Wxt,
} from "wxt";

import {
	DICT_SHARD_PUBLIC_PATH_TEMPLATE,
	DICTIONARY_META_PUBLIC_PATH,
	LEMMA_INDEX_PUBLIC_PATH,
} from "./src/shared/dictionary/assetPaths";
import { createUnoConfig } from "./uno.config";

// The selection UI lives in page shadow roots and gets px CSS; extension pages
// keep the rem config @wxt-dev/unocss loads from uno.config.ts.
const PX_CSS_ENTRYPOINT = "selection";

export default defineConfig({
	srcDir: "src",
	modules: ["@wxt-dev/unocss"],
	unocss: {
		excludeEntrypoints: ["annotator", "background", PX_CSS_ENTRYPOINT],
	},
	hooks: {
		"prepare:publicPaths": (_wxt: Wxt, paths: PublicPathEntry[]): void => {
			paths.push(DICTIONARY_META_PUBLIC_PATH, LEMMA_INDEX_PUBLIC_PATH, {
				path: DICT_SHARD_PUBLIC_PATH_TEMPLATE,
				type: "templateLiteral",
			});
		},
		"vite:build:extendConfig": (
			entrypoints: readonly Entrypoint[],
			viteConfig: InlineConfig,
		): void => {
			if (entrypoints.some((entry) => entry.name === PX_CSS_ENTRYPOINT)) {
				viteConfig.plugins = [
					...(viteConfig.plugins ?? []),
					// An inline config is merged under uno.config.ts unless the file
					// is switched off.
					UnoCSS({ ...createUnoConfig({ remToPx: true }), configFile: false }),
				];
			}
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
				strict_min_version: "140.0",
			},
		},
	},
	// scripts/packageFirefox.ts writes the sources zip with git archive;
	// WXT's own globs the repo root and ignores .gitignore.
	zip: {
		zipSources: false,
	},
	vite: () => ({
		plugins: [preact()],
	}),
});
