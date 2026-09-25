import { describe, expect, it, vi } from "vitest";

import type { LemmaEntry } from "@/shared/dictionary/types";

import { createLemmaExpansionService } from "./lemmaExpansionService";

const LEMMA_ROWS: readonly LemmaEntry[] = [
	{ lemma: "run", surface: "ran" },
	{ lemma: "run", surface: "run" },
	{ lemma: "run", surface: "running" },
	{ lemma: "run", surface: "runs" },
	{ lemma: "agenda", surface: "agendas" },
];

async function listRowsByLemmas(
	lemmas: readonly string[],
): Promise<readonly LemmaEntry[]> {
	return LEMMA_ROWS.filter((row) => lemmas.includes(row.lemma));
}

describe("createLemmaExpansionService", () => {
	it("expands each requested lemma to its surfaces plus itself", async () => {
		const listByLemmas = vi.fn(listRowsByLemmas);
		const service = createLemmaExpansionService({
			lemmaRepository: { listByLemmas: listByLemmas },
		});

		expect(await service.expandLemmas(["run", "unknown"])).toEqual({
			run: ["ran", "run", "running", "runs"],
			unknown: ["unknown"],
		});
		expect(listByLemmas).toHaveBeenCalledWith(["run", "unknown"]);
	});

	it("returns an empty result for empty input without touching the repository", async () => {
		const listByLemmas = vi.fn(listRowsByLemmas);
		const service = createLemmaExpansionService({
			lemmaRepository: { listByLemmas: listByLemmas },
		});

		expect(await service.expandLemmas([])).toEqual({});
		expect(listByLemmas).not.toHaveBeenCalled();
	});

	it("rejects with the repository error", async () => {
		const readError = new Error("read failed");
		const service = createLemmaExpansionService({
			lemmaRepository: {
				listByLemmas: async (): Promise<readonly LemmaEntry[]> => {
					throw readError;
				},
			},
		});

		await expect(service.expandLemmas(["go"])).rejects.toBe(readError);
	});
});
