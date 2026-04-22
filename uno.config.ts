import {
	defineConfig,
	presetAttributify,
	presetIcons,
	presetWind3,
	transformerAttributifyJsx,
	transformerVariantGroup,
} from "unocss";

export default defineConfig({
	presets: [presetWind3(), presetAttributify(), presetIcons()],
	transformers: [transformerVariantGroup(), transformerAttributifyJsx()],
});
