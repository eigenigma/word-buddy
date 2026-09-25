import { describe, expect, it } from "vitest";

import { createBackgroundServices } from "./composition";

const EXPECTED_SERVICE_KEYS = [
	"annotatorBroadcaster",
	"dictionaryQueryService",
	"dictionarySeedService",
	"lemmaExpansionService",
	"paragraphTranslator",
	"settingsService",
	"siteControlService",
	"translationCacheService",
	"wordbookService",
] as const;

describe("createBackgroundServices", () => {
	it("returns the full background service surface without duplicate instances", () => {
		const services = createBackgroundServices();
		const values = Object.values(services);

		expect(Object.keys(services).sort()).toEqual(
			[...EXPECTED_SERVICE_KEYS].sort(),
		);
		expect(new Set(values).size).toBe(values.length);
		expect(typeof services.annotatorBroadcaster.invalidate).toBe("function");
		expect(typeof services.dictionarySeedService.ensureSeeded).toBe("function");
		expect(typeof services.paragraphTranslator.translateParagraph).toBe(
			"function",
		);
		expect(typeof services.wordbookService.addWord).toBe("function");
	});
});
