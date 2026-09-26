import {
	AnnotatorInvalidateRequestSchema,
	AnnotatorSiteControlChangedRequestSchema,
} from "@/shared/runtime/messages/annotatorMessages";
import type { AnnotatorLogger } from "./logger";
import type { AnnotatorRuntime } from "./runtime";

export interface RegisterAnnotatorListenerDependencies {
	readonly isSiteBlocked: () => Promise<boolean>;
	readonly logger: AnnotatorLogger;
	readonly runtime: Pick<AnnotatorRuntime, "dispose" | "invalidate">;
}

export function registerAnnotatorListener(
	dependencies: RegisterAnnotatorListenerDependencies,
): () => void {
	const { isSiteBlocked, logger, runtime } = dependencies;
	const onMessage = (message: unknown): false => {
		if (AnnotatorInvalidateRequestSchema.safeParse(message).success) {
			runtime.invalidate().catch((error: unknown): void => {
				logger.warn("invalidation failed:", error);
			});
			return false;
		}

		if (!AnnotatorSiteControlChangedRequestSchema.safeParse(message).success) {
			return false;
		}

		isSiteBlocked()
			.then((blocked): void => {
				if (blocked) {
					runtime.dispose();
					removeListener();
				}
			})
			.catch((error: unknown): void => {
				logger.warn("site-control check failed:", error);
			});
		return false;
	};
	const removeListener = (): void => {
		browser.runtime.onMessage.removeListener(onMessage);
	};

	browser.runtime.onMessage.addListener(onMessage);
	return removeListener;
}
