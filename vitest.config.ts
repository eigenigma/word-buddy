import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		coverage: {
			exclude: [
				"**/*.test.ts",
				".wxt/**",
				".output/**",
				"public/**",
				"scripts/**",
				"vitest.config.ts",
				"wxt.config.ts",
			],
			provider: "v8",
		},
		environment: "node",
		include: ["src/**/*.{test,spec}.{ts,tsx}", "*.{test,spec}.{ts,tsx}"],
		setupFiles: ["fake-indexeddb/auto"],
	},
});
