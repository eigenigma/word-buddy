import { z } from "zod";

export const SUPPLEMENTAL_EXCHANGE_CODES = [
	"3",
	"d",
	"f",
	"i",
	"p",
	"r",
	"s",
	"t",
] as const;

const EXCHANGE_CODES = ["0", "1", ...SUPPLEMENTAL_EXCHANGE_CODES] as const;

type ExchangeCode = (typeof EXCHANGE_CODES)[number];

export type ExchangeMap = Partial<Record<ExchangeCode, string>>;

const ExchangeCodeSchema = z.enum(EXCHANGE_CODES);

export function parseExchangeMap(
	exchange: string | null,
	word: string,
): ExchangeMap {
	if (!exchange) {
		return {};
	}

	const mappings: ExchangeMap = {};
	const parts = exchange.split("/");

	for (const part of parts) {
		const [rawCode, rawValue] = part.split(":", 2);
		const codeResult = ExchangeCodeSchema.safeParse(rawCode);

		if (!codeResult.success || rawValue === undefined) {
			throw new Error(`Malformed exchange value for ${word}: ${exchange}`);
		}

		const normalizedValue = rawValue.trim();
		if (!normalizedValue) {
			continue;
		}

		mappings[codeResult.data] = normalizedValue;
	}

	return mappings;
}
