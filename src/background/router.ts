import type { BackgroundServices } from "@/background/composition";
import { dictionaryHandlerDescriptors } from "@/background/dictionary/router";
import { llmHandlerDescriptors } from "@/background/llm/router";
import type {
	BackgroundMessageResponse,
	BackgroundResponsePayload,
	HandlerDescriptor,
	MessageRouter,
} from "@/background/routerCore";
import { settingsHandlerDescriptors } from "@/background/settings/router";
import { siteControlHandlerDescriptors } from "@/background/siteControl/router";
import { wordbookHandlerDescriptors } from "@/background/wordbook/router";

const handlerDescriptors = [
	...dictionaryHandlerDescriptors,
	...settingsHandlerDescriptors,
	...wordbookHandlerDescriptors,
	...llmHandlerDescriptors,
	...siteControlHandlerDescriptors,
] as readonly HandlerDescriptor<unknown, BackgroundResponsePayload>[];

function tryHandleMessage(
	services: BackgroundServices,
	message: unknown,
	descriptor: HandlerDescriptor<unknown, BackgroundResponsePayload>,
): Promise<BackgroundResponsePayload> | null {
	const parsedMessage = descriptor.requestSchema.safeParse(message);
	if (!parsedMessage.success) {
		return null;
	}

	return descriptor.handle(services, parsedMessage.data);
}

export function createMessageRouter(
	services: BackgroundServices,
): MessageRouter {
	return {
		handle: (message: unknown): BackgroundMessageResponse => {
			for (const descriptor of handlerDescriptors) {
				const response = tryHandleMessage(services, message, descriptor);
				if (response !== null) {
					return response;
				}
			}

			return false;
		},
	};
}
