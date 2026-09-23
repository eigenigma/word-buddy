import type { ZodType } from "zod";

type PayloadWithoutType<Req extends { readonly type: string }> = Omit<
	Req,
	"type"
>;
type MessageClientArgs<Req extends { readonly type: string }> =
	keyof PayloadWithoutType<Req> extends never
		? []
		: [payload: PayloadWithoutType<Req>];

async function sendTypedMessage<Res>(
	request: unknown,
	responseSchema: ZodType<Res>,
): Promise<Res> {
	const response = await browser.runtime.sendMessage(request);
	return responseSchema.parse(response);
}

export function createMessageClient<
	Req extends { readonly type: string },
	Res,
>(descriptor: {
	readonly responseSchema: ZodType<Res>;
	readonly type: Req["type"];
}): (...args: MessageClientArgs<Req>) => Promise<Res> {
	return async (...args: MessageClientArgs<Req>): Promise<Res> => {
		const [payload] = args;
		return await sendTypedMessage(
			{
				...payload,
				type: descriptor.type,
			},
			descriptor.responseSchema,
		);
	};
}
