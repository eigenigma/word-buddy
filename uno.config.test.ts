// @vitest-environment jsdom
import { globSync } from "node:fs";
import { resolve } from "node:path";

import { createGenerator } from "unocss";
import UnoCSS, { type UnocssVitePluginAPI } from "unocss/vite";
import { assert, describe, expect, it } from "vitest";
import { splitShadowRootCss } from "wxt/utils/split-shadow-root-css";

import unoConfig, { CSS_VARIABLE_PREFIX } from "./uno.config";

async function generateSampleCss(): Promise<string> {
	const generator = await createGenerator(unoConfig);
	const { css } = await generator.generate([
		"bg-white",
		"shadow-xl",
		"sm:flex-row",
	]);
	return css;
}

const { documentCss, shadowCss } = splitShadowRootCss(
	await generateSampleCss(),
);

const shadowSheet = new CSSStyleSheet();
shadowSheet.replaceSync(shadowCss);
const shadowRules = Array.from(shadowSheet.cssRules);

const hoistedPreludes = documentCss
	.split("}")
	.map((block) => block.slice(0, block.indexOf("{")).trim())
	.filter((prelude) => prelude !== "");

function isStyleRule(rule: CSSRule): rule is CSSStyleRule {
	return rule instanceof CSSStyleRule;
}

function isMediaRule(rule: CSSRule): rule is CSSMediaRule {
	return rule instanceof CSSMediaRule;
}

function findStyleRule(selectorText: string): CSSStyleRule | undefined {
	return shadowRules
		.filter(isStyleRule)
		.find((rule) => rule.selectorText === selectorText);
}

describe("uno.config shadow-root stylesheet", () => {
	it("scopes theme variables to :host", () => {
		expect(findStyleRule(":root, :host")).toBeDefined();
	});

	it("applies the base reset to :host", () => {
		expect(findStyleRule("html, :host")).toBeDefined();
	});

	it("makes every border solid through the universal reset", () => {
		expect(
			shadowRules
				.filter(isStyleRule)
				.filter((rule) => rule.selectorText.split(", ").includes("*"))
				.map((rule) => rule.style.getPropertyValue("border-style")),
		).toContain("solid");
	});

	it("declares property initial values outside any @supports wrapper", () => {
		expect(
			findStyleRule("*, ::before, ::after, ::backdrop")?.style.getPropertyValue(
				`--${CSS_VARIABLE_PREFIX}bg-opacity`,
			),
		).toBe("100%");
	});

	// The unwrapped fallback omits the shadow and ring variables, so the
	// popup's shadows depend on these registrations reaching the host page.
	it("hoists the shadow variable registrations into the host document", () => {
		expect(hoistedPreludes).toContain(
			`@property --${CSS_VARIABLE_PREFIX}shadow`,
		);
	});

	it("namespaces everything hoisted into the host document", () => {
		expect(
			hoistedPreludes.filter(
				(prelude) => !prelude.startsWith(`@property --${CSS_VARIABLE_PREFIX}`),
			),
		).toEqual([]);
	});
});

describe("uno.config breakpoints", () => {
	it("uses the rem-based sm breakpoint", () => {
		expect(
			shadowRules.filter(isMediaRule).map((rule) => rule.media.mediaText),
		).toContain("(min-width: 40rem)");
	});
});

const sourceModules = globSync("src/**/*.{ts,tsx}", {
	exclude: ["**/*.test.{ts,tsx}"],
}).map((path) => resolve(path));

// createGenerator ignores content.pipeline, so this goes through the Vite
// plugin that WXT builds with, which loads uno.config.ts the same way.
describe("uno.config content pipeline", () => {
	it("scans every source module, plain .ts included", async () => {
		const api: UnocssVitePluginAPI | undefined = UnoCSS().find(
			(plugin) => plugin.name === "unocss:api",
		)?.api;
		assert.isDefined(api);
		const context = api.getContext();
		await context.ready;

		expect(sourceModules).not.toHaveLength(0);
		expect(sourceModules.filter((id) => !context.filter("", id))).toEqual([]);
	});
});
