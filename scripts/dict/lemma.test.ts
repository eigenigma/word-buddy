import { describe, expect, it } from "vitest";

import { buildDictionaryEntries, parseEcdictCsv } from "./ecdict";
import { buildLemmaIndex, type LemmaBuildResult } from "./lemma";

const ECDICT_HEADER =
	"word,phonetic,definition,translation,pos,collins,oxford,tag,bnc,frq,exchange,detail,audio";

function toEcdictLine(word: string, exchange = ""): string {
	return `${word},,${word} definition,${word} translation,v.,1,1,,1,1,${exchange},,`;
}

function buildFromWords(
	words: readonly (readonly [word: string, exchange?: string])[],
	lemmaText: string,
): LemmaBuildResult {
	const rows = parseEcdictCsv(
		[
			ECDICT_HEADER,
			...words.map(([word, exchange]) => toEcdictLine(word, exchange)),
		].join("\n"),
	);

	return buildLemmaIndex(rows, buildDictionaryEntries(rows).wordSet, lemmaText);
}

describe("buildLemmaIndex", () => {
	it("emits only rows that map a surface to another word", () => {
		const { counts, index } = buildFromWords(
			[["run", "p:ran/i:running/3:runs"]],
			"run -> ran, running, runs\n",
		);

		expect(index).toEqual({ ran: "run", running: "run", runs: "run" });
		expect(counts.lemmaEntries).toBe(3);
	});

	it("keeps an inflection with its own entry out of another lemma", () => {
		const { counts, index } = buildFromWords(
			[["leave", "p:left/d:left"], ["left"]],
			"leave -> leaves\n",
		);

		expect(index).toEqual({ leaves: "leave" });
		expect(counts.lemmaConflictsSkipped).toBe(1);
		expect(counts.lemmaEntries).toBe(1);
	});
});
