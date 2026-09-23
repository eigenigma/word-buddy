import {
	assert,
	beforeEach,
	describe,
	expect,
	it,
	type Mock,
	vi,
} from "vitest";

import type { OpenAiClientDependencies } from "@/background/llm/openaiClient";
import type { ParagraphTranslatorDependencies } from "@/background/llm/translator";
import type { SettingsServiceDependencies } from "@/background/settings/service";
import type { SiteControlServiceDependencies } from "@/background/siteControl/service";
import type { TranslationCacheService } from "@/background/translations/service";
import type { LlmSettings } from "@/shared/settings/types";

import { createLlmBrowserAdapter } from "./browserAdapters";

type GenericMock = Mock;
type FactoryMock<TDependencies> = Mock<
	(dependencies: TDependencies) => unknown
>;
type TranslationCacheClearMock = Mock<() => Promise<number>>;
type TranslationCacheGetMock = Mock<(hash: string) => Promise<null>>;
type TranslationCacheSetMock = Mock<(entry: unknown) => Promise<void>>;

interface HoistedMocks {
	readonly OPEN_AI_CLIENT: { readonly translateParagraph: GenericMock };
	readonly PARAGRAPH_TRANSLATOR: { readonly translateParagraph: GenericMock };
	readonly RATE_LIMITER: { readonly acquire: GenericMock };
	readonly RETRY_POLICY: { readonly attemptFetch: GenericMock };
	readonly SETTINGS_SERVICE: {
		readonly get: GenericMock;
		readonly set: GenericMock;
	};
	readonly SETTINGS_STORAGE: { readonly id: string };
	readonly SITE_CONTROL_SERVICE: { readonly id: string };
	readonly SITE_CONTROL_STORAGE: { readonly id: string };
	readonly TRANSLATION_CACHE_SERVICE: TranslationCacheService;
	readonly computeTranslationHashMock: GenericMock;
	readonly createBrowserStorageSettingsStorageMock: GenericMock;
	readonly createBrowserStorageSiteControlMock: GenericMock;
	readonly createExponentialRetryPolicyMock: GenericMock;
	readonly createOpenAiCompatibleClientMock: FactoryMock<OpenAiClientDependencies>;
	readonly createParagraphTranslatorMock: FactoryMock<ParagraphTranslatorDependencies>;
	readonly createSettingsServiceMock: FactoryMock<SettingsServiceDependencies>;
	readonly createSiteControlServiceMock: FactoryMock<SiteControlServiceDependencies>;
	readonly createTokenBucketRateLimiterMock: GenericMock;
	readonly sleepMock: GenericMock;
	readonly translationCacheClearMock: TranslationCacheClearMock;
	readonly translationCacheGetMock: TranslationCacheGetMock;
	readonly translationCacheSetMock: TranslationCacheSetMock;
}

function createHoistedMocks(): HoistedMocks {
	const translationCacheClearMock = vi.fn<() => Promise<number>>();
	const translationCacheGetMock = vi.fn<(hash: string) => Promise<null>>();
	const translationCacheSetMock = vi.fn<(entry: unknown) => Promise<void>>();

	return {
		OPEN_AI_CLIENT: { translateParagraph: vi.fn() },
		PARAGRAPH_TRANSLATOR: { translateParagraph: vi.fn() },
		RATE_LIMITER: { acquire: vi.fn() },
		RETRY_POLICY: { attemptFetch: vi.fn() },
		SETTINGS_SERVICE: { get: vi.fn(), set: vi.fn() },
		SETTINGS_STORAGE: { id: "settings-storage" },
		SITE_CONTROL_SERVICE: { id: "site-control" },
		SITE_CONTROL_STORAGE: { id: "site-control-storage" },
		TRANSLATION_CACHE_SERVICE: {
			clear: translationCacheClearMock,
			get: translationCacheGetMock,
			set: translationCacheSetMock,
		},
		computeTranslationHashMock: vi.fn(() => "hash"),
		createBrowserStorageSettingsStorageMock: vi.fn(),
		createBrowserStorageSiteControlMock: vi.fn(),
		createExponentialRetryPolicyMock: vi.fn(),
		createOpenAiCompatibleClientMock:
			vi.fn<(dependencies: OpenAiClientDependencies) => unknown>(),
		createParagraphTranslatorMock:
			vi.fn<(dependencies: ParagraphTranslatorDependencies) => unknown>(),
		createSettingsServiceMock:
			vi.fn<(dependencies: SettingsServiceDependencies) => unknown>(),
		createSiteControlServiceMock:
			vi.fn<(dependencies: SiteControlServiceDependencies) => unknown>(),
		createTokenBucketRateLimiterMock: vi.fn(),
		sleepMock: vi.fn(),
		translationCacheClearMock: translationCacheClearMock,
		translationCacheGetMock: translationCacheGetMock,
		translationCacheSetMock: translationCacheSetMock,
	};
}

const {
	OPEN_AI_CLIENT,
	PARAGRAPH_TRANSLATOR,
	RATE_LIMITER,
	RETRY_POLICY,
	SETTINGS_SERVICE,
	SETTINGS_STORAGE,
	SITE_CONTROL_SERVICE,
	SITE_CONTROL_STORAGE,
	TRANSLATION_CACHE_SERVICE,
	computeTranslationHashMock,
	createBrowserStorageSettingsStorageMock,
	createBrowserStorageSiteControlMock,
	createExponentialRetryPolicyMock,
	createOpenAiCompatibleClientMock,
	createParagraphTranslatorMock,
	createSettingsServiceMock,
	createSiteControlServiceMock,
	createTokenBucketRateLimiterMock,
	sleepMock,
	translationCacheClearMock,
	translationCacheGetMock,
	translationCacheSetMock,
} = vi.hoisted(createHoistedMocks);

vi.mock("@/background/llm/openaiClient", () => ({
	createOpenAiCompatibleClient: createOpenAiCompatibleClientMock,
}));
vi.mock("@/background/llm/rateLimiter", () => ({
	createTokenBucketRateLimiter: createTokenBucketRateLimiterMock,
}));
vi.mock("@/background/llm/retryPolicy", () => ({
	createExponentialRetryPolicy: createExponentialRetryPolicyMock,
}));
vi.mock("@/background/llm/translator", () => ({
	createParagraphTranslator: createParagraphTranslatorMock,
}));
vi.mock("@/background/settings/service", () => ({
	createSettingsService: createSettingsServiceMock,
}));
vi.mock("@/background/settings/storage", () => ({
	createBrowserStorageSettingsStorage: createBrowserStorageSettingsStorageMock,
}));
vi.mock("@/background/siteControl/service", () => ({
	createSiteControlService: createSiteControlServiceMock,
}));
vi.mock("@/background/siteControl/storage", () => ({
	createBrowserStorageSiteControl: createBrowserStorageSiteControlMock,
}));
vi.mock("@/background/translations/hash", () => ({
	computeTranslationHash: computeTranslationHashMock,
}));
vi.mock("@/shared/utils/async", () => ({
	sleep: sleepMock,
}));

function createAdapter(): ReturnType<typeof createLlmBrowserAdapter> {
	return createLlmBrowserAdapter({
		translationCacheService: TRANSLATION_CACHE_SERVICE,
	});
}

function resetMocks(): void {
	SETTINGS_SERVICE.get.mockReset();
	SETTINGS_SERVICE.set.mockReset();
	computeTranslationHashMock.mockClear();
	createBrowserStorageSettingsStorageMock.mockReset();
	createBrowserStorageSiteControlMock.mockReset();
	createExponentialRetryPolicyMock.mockReset();
	createOpenAiCompatibleClientMock.mockReset();
	createParagraphTranslatorMock.mockReset();
	createSettingsServiceMock.mockReset();
	createSiteControlServiceMock.mockReset();
	createTokenBucketRateLimiterMock.mockReset();
	sleepMock.mockReset();
	translationCacheClearMock.mockReset();
	translationCacheGetMock.mockReset();
	translationCacheSetMock.mockReset();
}

beforeEach(() => {
	resetMocks();
	createBrowserStorageSettingsStorageMock.mockReturnValue(SETTINGS_STORAGE);
	createBrowserStorageSiteControlMock.mockReturnValue(SITE_CONTROL_STORAGE);
	createSettingsServiceMock.mockReturnValue(SETTINGS_SERVICE);
	createSiteControlServiceMock.mockReturnValue(SITE_CONTROL_SERVICE);
	createTokenBucketRateLimiterMock.mockReturnValue(RATE_LIMITER);
	createExponentialRetryPolicyMock.mockReturnValue(RETRY_POLICY);
	createOpenAiCompatibleClientMock.mockReturnValue(OPEN_AI_CLIENT);
	createParagraphTranslatorMock.mockReturnValue(PARAGRAPH_TRANSLATOR);
});

describe("createLlmBrowserAdapter", () => {
	it("returns paragraph translator, settings, site control, and translation cache services", () => {
		expect(createAdapter()).toEqual({
			paragraphTranslator: PARAGRAPH_TRANSLATOR,
			settingsService: SETTINGS_SERVICE,
			siteControlService: SITE_CONTROL_SERVICE,
			translationCacheService: TRANSLATION_CACHE_SERVICE,
		});
	});
});

describe("llm settings wiring", () => {
	it("injects storage adapters into settings and site-control services", () => {
		createAdapter();

		expect(createSettingsServiceMock).toHaveBeenLastCalledWith({
			storage: SETTINGS_STORAGE,
		});
		expect(createSiteControlServiceMock).toHaveBeenLastCalledWith({
			storage: SITE_CONTROL_STORAGE,
		});
	});
});

describe("openai client wiring", () => {
	it("injects retry helpers and delegates settings reads", async () => {
		const settings: LlmSettings = {
			apiKey: "sk-test",
			endpoint: "https://example.com/v1/chat/completions",
			model: "gpt-4.1-mini",
		};
		SETTINGS_SERVICE.get.mockResolvedValue(settings);
		createAdapter();

		const dependencies = createOpenAiCompatibleClientMock.mock.lastCall?.[0];
		assert.isDefined(dependencies);

		expect(createTokenBucketRateLimiterMock).toHaveBeenCalledTimes(1);
		expect(createExponentialRetryPolicyMock).toHaveBeenCalledTimes(1);
		expect(dependencies.rateLimiter).toBe(RATE_LIMITER);
		expect(dependencies.retryPolicy).toBe(RETRY_POLICY);
		expect(typeof dependencies.fetcher).toBe("function");
		await expect(dependencies.getSettings()).resolves.toEqual(settings);
	});
});

describe("paragraph translator wiring", () => {
	it("injects cache, client, clock, hash, and settings reader", async () => {
		const settings: LlmSettings = {
			apiKey: "sk-test",
			endpoint: "https://example.com/v1/chat/completions",
			model: "gpt-4.1-mini",
		};
		SETTINGS_SERVICE.get.mockResolvedValue(settings);
		vi.spyOn(Date, "now").mockReturnValue(1234);
		createAdapter();

		const dependencies = createParagraphTranslatorMock.mock.lastCall?.[0];
		assert.isDefined(dependencies);

		expect(dependencies.cache).toBe(TRANSLATION_CACHE_SERVICE);
		expect(dependencies.client).toBe(OPEN_AI_CLIENT);
		expect(dependencies.clock()).toBe(1234);
		expect(dependencies.computeHash).toBe(computeTranslationHashMock);
		await expect(dependencies.getSettings()).resolves.toEqual(settings);
	});
});
