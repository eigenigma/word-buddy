import { z } from "zod";

// Unlike z.number(), accepts NaN and Infinity; callers that need finite
// values refine it.
export const NumberSchema: z.ZodType<number> = z.custom<number>(
	(value): value is number => typeof value === "number",
);

export const NullableStringSchema: z.ZodType<string | null> = z
	.string()
	.nullable();

export const ReadonlyStringArraySchema: z.ZodType<readonly string[]> = z
	.array(z.string())
	.readonly();

export const ReadonlyStringRecordSchema: z.ZodType<
	Readonly<Record<string, string>>
> = z.record(z.string(), z.string()).readonly();
