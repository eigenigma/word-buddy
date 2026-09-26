import {
	AnnotatorInvalidateRequestSchema,
	AnnotatorSiteControlChangedRequestSchema,
} from "@/shared/runtime/messages/annotatorMessages";
import type { AnnotatorLogger } from "./logger";
import type { AnnotatorRuntime } from "./runtime";

export interface RegisterAnnotatorListenerDependencies {
	readonly disposeRuntime: (runtime: AnnotatorRuntime) => void;
	readonly host: string;
	readonly isCurrentHostBlocked: (host: string) => Promise<boolean>;
	readonly logger: AnnotatorLogger;
	readonly runtime: AnnotatorRuntime;
}

export function registerAnnotatorListener(
	dependencies: RegisterAnnotatorListenerDependencies,
): () => void {
	const { disposeRuntime, host, isCurrentHostBlocked, logger, runtime } =
		dependencies;
	const onMessage = (message: unknown): false => {
		if (AnnotatorInvalidateRequestSchema.safeParse(message).success) {
			runtime.invalidationController
				.onInvalidate()
				.catch((error: unknown): void => {
					logger.warn("invalidation failed:", error);
				});
			return false;
		}

		if (!AnnotatorSiteControlChangedRequestSchema.safeParse(message).success) {
			return false;
		}

		isCurrentHostBlocked(host)
			.then((blocked): void => {
				if (blocked) {
					disposeRuntime(runtime);
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
