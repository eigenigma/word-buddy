import { describe, expect, it } from "vitest";

import type { DictionaryEntry } from "../shared/dictionary/types";
import type { TranslateParagraphResult } from "../shared/llm/types";
import type { LlmSettings } from "../shared/settings/types";
import type { SiteControlState } from "../shared/siteControl/types";
import type { TranslationCacheEntry } from "../shared/translations/types";
import type {
	WordbookEntry,
	WordbookUpdatePatch,
} from "../shared/wordbook/types";
import { createTestDictionaryEntry } from "../test-helpers/dictionaryFixtures";
import type { BackgroundServices } from "./composition";
import type { DictionaryResolution } from "./dictionary/resolveService";
import { createMessageRouter } from "./router";

const TEST_DICTIONARY_ENTRY: DictionaryEntry = createTestDictionaryEntry(
	"agenda",
	{ phonetic: "/əˈdʒen.də/" },
);

const TEST_SETTINGS: LlmSettings = {
	apiKey: "sk-test",
	endpoint: "https://example.com/v1/chat/completions",
	model: "gpt-test",
};

const TEST_SITE_CONTROL_STATE: SiteControlState = {
	blockedHosts: ["example.com"],
};

const TEST_TRANSLATION_RESULT: TranslateParagraphResult = {
	cached: false,
	translations: {
		agenda: "议程",
	},
};

const TEST_WORDBOOK_ENTRY: WordbookEntry = {
	addedAt: 1,
	context: "agenda context",
	lemma: "agenda",
	original: "agenda",
	sourceUrl: "https://example.com/article",
};

const VALID_ROUTER_CASES = [
	{
		message: {
			lemmas: ["agenda"],
			type: "wordBuddy.dictionary.expandLemmas",
		},
		response: {
			expansions: { agenda: ["agenda", "agendas"] },
		},
	},
	{
		message: { selection: "Agendas", type: "wordBuddy.dictionary.resolve" },
		response: {
			resolution: {
				entry: {
					definition: TEST_DICTIONARY_ENTRY.definition,
					frequency: TEST_DICTIONARY_ENTRY.frequency,
					phonetic: TEST_DICTIONARY_ENTRY.phonetic,
					pos: TEST_DICTIONARY_ENTRY.pos,
					translation: TEST_DICTIONARY_ENTRY.translation,
					word: TEST_DICTIONARY_ENTRY.word,
				},
				lemma: "agenda",
			},
		},
	},
	{
		message: { type: "wordBuddy.settings.get" },
		response: { settings: TEST_SETTINGS },
	},
	{
		message: { settings: TEST_SETTINGS, type: "wordBuddy.settings.set" },
		response: { settings: TEST_SETTINGS },
	},
	{
		message: { input: TEST_WORDBOOK_ENTRY, type: "wordBuddy.wordbook.add" },
		response: { added: true, error: null },
	},
	{
		message: {
			lemma: TEST_WORDBOOK_ENTRY.lemma,
			type: "wordBuddy.wordbook.exists",
		},
		response: { exists: true },
	},
	{
		message: { type: "wordBuddy.wordbook.list" },
		response: { entries: [TEST_WORDBOOK_ENTRY] },
	},
	{
		message: {
			lemma: TEST_WORDBOOK_ENTRY.lemma,
			type: "wordBuddy.wordbook.remove",
		},
		response: { error: null, removed: true },
	},
	{
		message: {
			lemma: TEST_WORDBOOK_ENTRY.lemma,
			patch: { original: "updated agenda" },
			type: "wordBuddy.wordbook.update",
		},
		response: {
			entry: {
				...TEST_WORDBOOK_ENTRY,
				original: "updated agenda",
			},
			error: null,
			updated: true,
		},
	},
	{
		message: {
			input: { paragraph: "agenda", words: ["agenda"] },
			type: "wordBuddy.llm.translateParagraph",
		},
		response: {
			cached: false,
			error: null,
			translations: { agenda: "议程" },
		},
	},
	{
		message: { type: "wordBuddy.llm.translationCacheClear" },
		response: { clearedCount: 2 },
	},
	{
		message: { type: "wordBuddy.siteControl.list" },
		response: { state: TEST_SITE_CONTROL_STATE },
	},
	{
		message: {
			host: "example.com",
			type: "wordBuddy.siteControl.isHostBlocked",
		},
		response: { blocked: true },
	},
	{
		message: {
			blocked: true,
			host: "example.com",
			type: "wordBuddy.siteControl.setHostBlocked",
		},
		response: { state: TEST_SITE_CONTROL_STATE },
	},
] as const;

const MALFORMED_ROUTER_MESSAGES = [
	{ lemmas: [1], type: "wordBuddy.dictionary.expandLemmas" },
	{ selection: 1, type: "wordBuddy.dictionary.resolve" },
	{ settings: { apiKey: 1 }, type: "wordBuddy.settings.set" },
	{ input: { lemma: 1 }, type: "wordBuddy.wordbook.add" },
	{ lemma: 1, type: "wordBuddy.wordbook.exists" },
	{ lemma: 1, type: "wordBuddy.wordbook.remove" },
	{
		lemma: "agenda",
		patch: { original: 1 },
		type: "wordBuddy.wordbook.update",
	},
	{
		input: { paragraph: 1, words: [] },
		type: "wordBuddy.llm.translateParagraph",
	},
	{ host: 1, type: "wordBuddy.siteControl.isHostBlocked" },
	{ blocked: true, host: 1, type: "wordBuddy.siteControl.setHostBlocked" },
	{ type: "wordBuddy.unknown" },
] as const;

function createServices(
	overrides: Partial<BackgroundServices> = {},
): BackgroundServices {
	return {
		annotatorBroadcaster: {
			invalidate: async (): Promise<void> => undefined,
			siteControlChanged: async (): Promise<void> => undefined,
		},
		dictionaryResolveService: {
			resolve: async (
				selection: string,
			): Promise<DictionaryResolution | null> =>
				selection === "Agendas"
					? { entry: TEST_DICTIONARY_ENTRY, lemma: "agenda" }
					: null,
		},
		dictionarySeedService: {
			ensureSeeded: async (): Promise<void> => undefined,
		},
		lemmaExpansionService: {
			expandLemmas: async (lemmas: readonly string[]) =>
				Object.fromEntries(
					lemmas.map((lemma) => [lemma, [lemma, `${lemma}s`]] as const),
				),
		},
		paragraphTranslator: {
			translateParagraph: async () => TEST_TRANSLATION_RESULT,
		},
		settingsService: {
			get: async () => TEST_SETTINGS,
			set: async (settings: LlmSettings) => settings,
		},
		siteControlService: {
			isHostBlocked: async (host: string) => host === "example.com",
			listBlockedHosts: async () => TEST_SITE_CONTROL_STATE.blockedHosts,
			setHostBlocked: async (): Promise<SiteControlState> =>
				TEST_SITE_CONTROL_STATE,
		},
		translationCacheService: {
			clear: async () => 2,
			get: async (_hash: string): Promise<TranslationCacheEntry | null> => null,
			set: async (_entry: TranslationCacheEntry): Promise<void> => undefined,
		},
		wordbookService: {
			addWord: async (_input: WordbookEntry) => ({ added: true }),
			existsByLemma: async (lemma: string) =>
				lemma === TEST_WORDBOOK_ENTRY.lemma,
			listAll: async () => [TEST_WORDBOOK_ENTRY],
			removeByLemma: async (_lemma: string) => ({ removed: true }),
			updateEntry: async (_lemma: string, patch: WordbookUpdatePatch) => ({
				entry: {
					...TEST_WORDBOOK_ENTRY,
					context: patch.context ?? TEST_WORDBOOK_ENTRY.context,
					original: patch.original ?? TEST_WORDBOOK_ENTRY.original,
				},
				updated: true,
			}),
		},
		...overrides,
	};
}

function createFailingWordbookService(): BackgroundServices["wordbookService"] {
	return {
		addWord: async (): Promise<{ readonly added: boolean }> => {
			throw new Error("wordbook add failed");
		},
		existsByLemma: async (): Promise<boolean> => false,
		listAll: async (): Promise<readonly WordbookEntry[]> => [],
		removeByLemma: async (): Promise<{ readonly removed: boolean }> => ({
			removed: false,
		}),
		updateEntry: async (): Promise<{
			readonly entry: WordbookEntry | null;
			readonly updated: boolean;
		}> => ({
			entry: null,
			updated: false,
		}),
	};
}

describe("createMessageRouter routing", () => {
	it("routes every registered message type", async () => {
		const router = createMessageRouter(createServices());
		for (const testCase of VALID_ROUTER_CASES) {
			await expect(router.handle(testCase.message)).resolves.toEqual(
				testCase.response,
			);
		}
	});
});

describe("createMessageRouter validation", () => {
	it("returns false for malformed payloads and unknown messages", () => {
		const router = createMessageRouter(createServices());
		for (const message of MALFORMED_ROUTER_MESSAGES) {
			expect(router.handle(message)).toBe(false);
		}
	});
});

describe("createMessageRouter dictionary branches", () => {
	it("passes a null resolution and a null entry through unchanged", async () => {
		const router = createMessageRouter(
			createServices({
				dictionaryResolveService: {
					resolve: async (
						selection: string,
					): Promise<DictionaryResolution | null> =>
						selection === "zzz" ? { entry: null, lemma: "zzz" } : null,
				},
			}),
		);

		await expect(
			router.handle({ selection: " ", type: "wordBuddy.dictionary.resolve" }),
		).resolves.toEqual({ resolution: null });
		await expect(
			router.handle({ selection: "zzz", type: "wordBuddy.dictionary.resolve" }),
		).resolves.toEqual({ resolution: { entry: null, lemma: "zzz" } });
	});
});

describe("createMessageRouter wordbook branches", () => {
	it("does not broadcast invalidation when wordbook mutations report no change", async () => {
		const invalidateMock = async (): Promise<void> => undefined;
		const router = createMessageRouter(
			createServices({
				annotatorBroadcaster: {
					invalidate: invalidateMock,
					siteControlChanged: async (): Promise<void> => undefined,
				},
				wordbookService: {
					addWord: async (): Promise<{ readonly added: boolean }> => ({
						added: false,
					}),
					existsByLemma: async (): Promise<boolean> => false,
					listAll: async (): Promise<readonly WordbookEntry[]> => [],
					removeByLemma: async (): Promise<{ readonly removed: boolean }> => ({
						removed: false,
					}),
					updateEntry: async (): Promise<{
						readonly entry: WordbookEntry | null;
						readonly updated: boolean;
					}> => ({
						entry: null,
						updated: false,
					}),
				},
			}),
		);

		await expect(
			router.handle({
				input: TEST_WORDBOOK_ENTRY,
				type: "wordBuddy.wordbook.add",
			}),
		).resolves.toEqual({ added: false, error: null });
		await expect(
			router.handle({
				lemma: TEST_WORDBOOK_ENTRY.lemma,
				type: "wordBuddy.wordbook.remove",
			}),
		).resolves.toEqual({ error: null, removed: false });
	});
});

describe("createMessageRouter error envelopes", () => {
	it("wraps mutating handler errors in the response envelope", async () => {
		const router = createMessageRouter(
			createServices({
				wordbookService: createFailingWordbookService(),
			}),
		);

		await expect(
			router.handle({
				input: TEST_WORDBOOK_ENTRY,
				type: "wordBuddy.wordbook.add",
			}),
		).resolves.toEqual({
			added: false,
			error: "wordbook add failed",
		});
	});
});
