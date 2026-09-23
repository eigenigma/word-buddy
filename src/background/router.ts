import type { BackgroundServices } from "@/background/composition";
import { dictionaryMessageHandlers } from "@/background/dictionary/router";
import { llmMessageHandlers } from "@/background/llm/router";
import type {
	BackgroundMessageResponse,
	MessageHandler,
	MessageRouter,
} from "@/background/routerCore";
import { settingsMessageHandlers } from "@/background/settings/router";
import { siteControlMessageHandlers } from "@/background/siteControl/router";
import { wordbookMessageHandlers } from "@/background/wordbook/router";

const messageHandlers: readonly MessageHandler[] = [
	...dictionaryMessageHandlers,
	...settingsMessageHandlers,
	...wordbookMessageHandlers,
	...llmMessageHandlers,
	...siteControlMessageHandlers,
];

export function createMessageRouter(
	services: BackgroundServices,
): MessageRouter {
	return {
		handle: (message: unknown): BackgroundMessageResponse => {
			for (const handleMessage of messageHandlers) {
				const response = handleMessage(services, message);
				if (response !== null) {
					return response;
				}
			}

			return false;
		},
	};
}
