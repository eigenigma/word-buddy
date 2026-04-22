import { toError } from "@/shared/utils/errors";

export interface RetryPolicy {
	readonly attemptFetch: (
		request: () => Promise<Response>,
	) => Promise<Response>;
}

interface ExponentialRetryPolicyDependencies {
	readonly baseDelayMs: number;
	readonly maxAttempts: number;
	readonly maxDelayMs: number;
	readonly now: () => number;
	readonly random: () => number;
	readonly sleep: (ms: number) => Promise<void>;
}

function clampDelay(delayMs: number, maxDelayMs: number): number {
	return Math.min(maxDelayMs, Math.max(0, delayMs));
}

function computeBackoffDelayMs(
	attempt: number,
	dependencies: Pick<
		ExponentialRetryPolicyDependencies,
		"baseDelayMs" | "maxDelayMs" | "random"
	>,
): number {
	const cappedBaseDelay = Math.min(
		dependencies.maxDelayMs,
		dependencies.baseDelayMs * 2 ** attempt,
	);
	return Math.floor(cappedBaseDelay * dependencies.random());
}

function parseRetryAfterMs(
	headerValue: string | null,
	dependencies: Pick<ExponentialRetryPolicyDependencies, "maxDelayMs" | "now">,
): number | null {
	if (headerValue === null) {
		return null;
	}

	const trimmedValue = headerValue.trim();
	if (/^\d+$/u.test(trimmedValue)) {
		return clampDelay(
			Number.parseInt(trimmedValue, 10) * 1000,
			dependencies.maxDelayMs,
		);
	}

	const parsedDate = Date.parse(trimmedValue);
	if (Number.isNaN(parsedDate)) {
		return null;
	}

	return clampDelay(parsedDate - dependencies.now(), dependencies.maxDelayMs);
}

function isRetryableResponse(response: Response): boolean {
	return response.status === 429 || response.status >= 500;
}

function createBackoffDependencies(
	dependencies: ExponentialRetryPolicyDependencies,
): Pick<
	ExponentialRetryPolicyDependencies,
	"baseDelayMs" | "maxDelayMs" | "random"
> {
	return {
		baseDelayMs: dependencies.baseDelayMs,
		maxDelayMs: dependencies.maxDelayMs,
		random: dependencies.random,
	};
}

function getRetryDelayMs(
	attempt: number,
	response: Response,
	dependencies: ExponentialRetryPolicyDependencies,
): number {
	const backoffDependencies = createBackoffDependencies(dependencies);
	if (response.status !== 429) {
		return computeBackoffDelayMs(attempt, backoffDependencies);
	}

	return (
		parseRetryAfterMs(response.headers.get("Retry-After"), {
			maxDelayMs: backoffDependencies.maxDelayMs,
			now: dependencies.now,
		}) ?? computeBackoffDelayMs(attempt, backoffDependencies)
	);
}

function isLastAttempt(attempt: number, maxAttempts: number): boolean {
	return attempt === maxAttempts - 1;
}

type RetryDecision =
	| { readonly kind: "return"; readonly response: Response }
	| { readonly delayMs: number; readonly kind: "retry" };

function decideRetry(
	attempt: number,
	response: Response,
	maxAttempts: number,
	dependencies: ExponentialRetryPolicyDependencies,
	backoffDependencies: Pick<
		ExponentialRetryPolicyDependencies,
		"baseDelayMs" | "maxDelayMs" | "random"
	>,
): RetryDecision {
	if (
		response.ok ||
		!isRetryableResponse(response) ||
		isLastAttempt(attempt, maxAttempts)
	) {
		return {
			kind: "return",
			response: response,
		};
	}

	return {
		delayMs:
			response.status === 429
				? getRetryDelayMs(attempt, response, dependencies)
				: computeBackoffDelayMs(attempt, backoffDependencies),
		kind: "retry",
	};
}

export function createExponentialRetryPolicy(
	dependencies: ExponentialRetryPolicyDependencies,
): RetryPolicy {
	const maxAttempts = dependencies.maxAttempts;
	const backoffDependencies = createBackoffDependencies(dependencies);

	return {
		attemptFetch: async (
			request: () => Promise<Response>,
		): Promise<Response> => {
			let lastError: unknown = null;

			for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
				try {
					const response = await request();
					const decision = decideRetry(
						attempt,
						response,
						maxAttempts,
						dependencies,
						backoffDependencies,
					);
					if (decision.kind === "return") {
						return decision.response;
					}

					await dependencies.sleep(decision.delayMs);
				} catch (error: unknown) {
					lastError = error;
					if (isLastAttempt(attempt, maxAttempts)) {
						throw error;
					}

					await dependencies.sleep(
						computeBackoffDelayMs(attempt, backoffDependencies),
					);
				}
			}

			throw toError(lastError, "Retry policy exhausted without a response.");
		},
	};
}
