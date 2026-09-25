import { describe, expect, it } from "vitest";

import { sortStrings } from "./utils";

describe("sortStrings", () => {
	it("orders by code point instead of locale collation", () => {
		expect(sortStrings(["b", "a", "B", "_", "a-b", "ab"])).toEqual([
			"B",
			"_",
			"a",
			"a-b",
			"ab",
			"b",
		]);
	});

	it("drops duplicates", () => {
		expect(sortStrings(["b", "a", "b"])).toEqual(["a", "b"]);
	});
});
