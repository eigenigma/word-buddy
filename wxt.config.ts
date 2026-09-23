import preact from "@preact/preset-vite";
import { defineConfig, type Wxt } from "wxt";

type ObjectWebAccessibleResource = Exclude<
	NonNullable<Browser.runtime.Manifest["web_accessible_resources"]>[number],
	string
>;

function isObjectWebAccessibleResources(
	resources: NonNullable<Browser.runtime.Manifest["web_accessible_resources"]>,
): resources is ObjectWebAccessibleResource[] {
	return resources.every((resource): boolean => typeof resource !== "string");
}

export default defineConfig({
	srcDir: "src",
	modules: ["@wxt-dev/unocss"],
	hooks: {
		"build:manifestGenerated": (
			wxt: Wxt,
			manifest: Browser.runtime.Manifest,
		): void => {
			if (
				wxt.config.browser !== "firefox" ||
				wxt.config.manifestVersion !== 3
			) {
				return;
			}

			const resources = manifest.web_accessible_resources;
			if (!resources) {
				return;
			}
			if (!isObjectWebAccessibleResources(resources)) {
				return;
			}

			manifest.web_accessible_resources = resources.map(
				(resource): ObjectWebAccessibleResource => {
					const { use_dynamic_url: _useDynamicUrl, ...nextResource } = resource;
					return nextResource;
				},
			);
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
