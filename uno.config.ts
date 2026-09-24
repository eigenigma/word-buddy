import {
	defineConfig,
	presetAttributify,
	presetIcons,
	presetWind4,
	transformerAttributifyJsx,
	transformerVariantGroup,
} from "unocss";

// WXT hoists the @property registrations into the host page, where UnoCSS's
// default --un-* names would collide with the page's own utilities.
export const CSS_VARIABLE_PREFIX = "word-buddy-";

export default defineConfig({
	presets: [
		presetWind4({
			variablePrefix: CSS_VARIABLE_PREFIX,
			preflights: {
				reset: true,
				theme: "on-demand",
				// Shadow roots ignore @property, and the default @supports
				// wrapper around the fallback initial values fails in Firefox.
				property: { parent: false },
			},
		}),
		presetAttributify(),
		presetIcons(),
	],
	transformers: [transformerVariantGroup(), transformerAttributifyJsx()],
});
