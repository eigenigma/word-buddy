import { z } from "zod";

import type {
	TranslateParagraphInput,
	TranslationMap,
} from "@/shared/llm/types";
import { isSettingsComplete, type LlmSettings } from "@/shared/settings/types";

import type { RateLimiter } from "./rateLimiter";
import type { RetryPolicy } from "./retryPolicy";

export interface OpenAiClientDependencies {
	readonly fetcher: typeof fetch;
	readonly getSettings: () => Promise<LlmSettings>;
	readonly rateLimiter: RateLimiter;
	readonly retryPolicy: RetryPolicy;
}

export interface OpenAiCompatibleClient {
	readonly translateParagraph: (
		input: TranslateParagraphInput,
	) => Promise<TranslationMap>;
}

const SYSTEM_PROMPT =
	"You translate English words into Simplified Chinese based on the surrounding paragraph context. You must output a JSON object whose keys are exactly the input words and whose values are the best single Chinese translation for that context. Output only the JSON object, no prose, no code fences.";

const OpenAiChatCompletionSchema = z
	.object({
		choices: z
			.array(
				z
					.object({
						message: z
							.object({
								content: z.string(),
							})
							.readonly(),
					})
					.readonly(),
			)
			.min(1)
			.readonly(),
	})
	.readonly();

function buildUserMessage(input: TranslateParagraphInput): string {
	return `Paragraph: ${input.paragraph}\n\nWords: ${JSON.stringify(input.words)}`;
}

function parseJsonContent(content: string): unknown {
	try {
		return JSON.parse(content) as unknown;
	} catch (error: unknown) {
		throw new Error("LLM response was not valid JSON", { cause: error });
	}
}

function createTranslationMapSchema(
	words: readonly string[],
): z.ZodType<TranslationMap> {
	const shape: Record<string, z.ZodString> = {};
	for (const word of words) {
		shape[word] = z.string();
	}

	return z.object(shape).readonly();
}

function validateTranslationMap(
	parsed: unknown,
	words: readonly string[],
): TranslationMap {
	return createTranslationMapSchema(words).parse(parsed);
}

export function createOpenAiCompatibleClient(
	dependencies: OpenAiClientDependencies,
): OpenAiCompatibleClient {
	return {
		translateParagraph: async (
			input: TranslateParagraphInput,
		): Promise<TranslationMap> => {
			const settings = await dependencies.getSettings();
			if (!isSettingsComplete(settings)) {
				throw new Error("LLM settings incomplete");
			}

			await dependencies.rateLimiter.acquire();
			const response = await dependencies.retryPolicy.attemptFetch(() =>
				dependencies.fetcher(settings.endpoint, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${settings.apiKey}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: settings.model,
						messages: [
							{ role: "system", content: SYSTEM_PROMPT },
							{ role: "user", content: buildUserMessage(input) },
						],
						response_format: { type: "json_object" },
					}),
				}),
			);

			if (!response.ok) {
				const body = await response.text();
				throw new Error(
					`LLM request failed (${response.status}): ${body.slice(0, 200)}`,
				);
			}

			const payload = OpenAiChatCompletionSchema.parse(await response.json());
			const firstChoice = payload.choices[0];
			if (firstChoice === undefined) {
				throw new Error("LLM response missing message content");
			}
			const parsed = parseJsonContent(firstChoice.message.content);
			return validateTranslationMap(parsed, input.words);
		},
	};
}
