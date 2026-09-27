import { createRemToPxProcessor } from "@unocss/preset-wind4/utils";
import { defineConfig, presetWind4, type UserConfig } from "unocss";

// WXT hoists the @property registrations into the host page, where UnoCSS's
// default --un-* names would collide with the page's own utilities.
export const CSS_VARIABLE_PREFIX = "word-buddy-";

interface UnoConfigOptions {
	// A shadow root's rem follows the host page's root font-size, so UI that
	// lives in a page renders in px to match the px it is positioned by.
	readonly remToPx: boolean;
}

export function createUnoConfig({ remToPx }: UnoConfigOptions): UserConfig {
	const remToPxProcessors = remToPx ? [createRemToPxProcessor()] : [];

	return defineConfig({
		content: {
			pipeline: {
				// Replaces UnoCSS's default filter rather than extending it, so .tsx
				// must stay listed next to the plain .ts modules that hold classes.
				include: ["src/**/*.{ts,tsx}"],
			},
		},
		postprocess: remToPxProcessors,
		presets: [
			presetWind4({
				variablePrefix: CSS_VARIABLE_PREFIX,
				preflights: {
					reset: true,
					theme: {
						mode: "on-demand",
						process: remToPxProcessors,
					},
					// Shadow roots ignore @property, and the default @supports
					// wrapper around the fallback initial values fails in Firefox.
					property: { parent: false },
				},
			}),
		],
	});
}

export default createUnoConfig({ remToPx: false });
