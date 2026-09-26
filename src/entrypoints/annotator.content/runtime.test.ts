// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { AhoCorasickMatcher } from "@/shared/matching/ahoCorasick";
import {
	type AnnotatorHarness,
	annotateOnce,
	createAnnotatorHarness,
	createMatcher,
	glossEach,
	settle,
	startAndReveal,
} from "@/test-helpers/annotatorRuntimeHarness";
import { mountBlock } from "@/test-helpers/dom";

let activeHarness: AnnotatorHarness | null = null;

function createHarness(
	matchers: readonly (AhoCorasickMatcher | null)[],
): AnnotatorHarness {
	activeHarness = createAnnotatorHarness(matchers);
	return activeHarness;
}

afterEach(() => {
	activeHarness?.runtime.dispose();
	activeHarness = null;
	document.designMode = "off";
	document.body.replaceChildren();
});

describe("annotator runtime scheduling", () => {
	it("annotates a block only once it is visible", async () => {
		const block = mountBlock("<p>I run daily.</p>");
		const harness = createHarness([createMatcher("run")]);

		await harness.runtime.start();
		await settle();
		expect(harness.translations).toHaveLength(0);

		await harness.reveal();
		expect(harness.translations.map((call) => call.input)).toStrictEqual([
			{ paragraph: "I run daily.", words: ["run"] },
		]);

		glossEach(harness.translations[0]);
		await settle();
		expect(block.textContent).toBe("I run(run-zh) daily.");
	});

	it("leaves a block that has not shown yet observed as it is", async () => {
		mountBlock("<p>I run and walk.</p>");
		const harness = createHarness([
			createMatcher("run"),
			createMatcher("run", "walk"),
		]);
		await harness.runtime.start();
		const observeCountBefore = harness.observeCount();

		await harness.runtime.invalidate();
		expect(harness.observeCount()).toBe(observeCountBefore);

		await harness.reveal();
		expect(harness.translations.map((call) => call.input.words)).toStrictEqual([
			["run", "walk"],
		]);
	});

	it("gives a nested block's words to that block alone", async () => {
		mountBlock("<ul><li>We run <p>and walk far.</p> home</li></ul>");
		const harness = createHarness([createMatcher("run", "walk")]);

		await startAndReveal(harness);

		expect(harness.translations.map((call) => call.input)).toStrictEqual([
			{ paragraph: "We run\nhome", words: ["run"] },
			{ paragraph: "and walk far.", words: ["walk"] },
		]);
	});

	it("re-requests a changed block with its glosses read as words", async () => {
		const block = mountBlock("<p>I run daily.</p>");
		const harness = createHarness([createMatcher("run")]);
		await annotateOnce(harness);

		block.append(" We run again.");
		harness.flushMutations();
		await harness.reveal();

		expect(
			harness.translations.map((call) => call.input.paragraph),
		).toStrictEqual(["I run daily.", "I run daily. We run again."]);
	});

	it("does not retry a failed translation until the block changes", async () => {
		const block = mountBlock("<p>I run daily.</p>");
		const harness = createHarness([createMatcher("run")]);
		await startAndReveal(harness);

		harness.translations[0]?.reject(new Error("offline"));
		await settle();

		expect(harness.warnings).toHaveLength(1);
		expect(harness.isVisibilityObserved(block)).toBe(false);
	});
});

describe("annotator runtime mutation ownership", () => {
	it("ignores a delivery that holds only its own replacements", async () => {
		const block = mountBlock("<p>I run daily.</p>");
		const harness = createHarness([createMatcher("run")]);
		const observeCountBefore = harness.observeCount();

		await annotateOnce(harness);

		expect(harness.isVisibilityObserved(block)).toBe(false);
		expect(harness.observeCount()).toBe(observeCountBefore + 1);
		expect(harness.translations).toHaveLength(1);
	});

	it("rescans a block the page removed text from", async () => {
		const block = mountBlock("<p>I run daily. <em>Always.</em></p>");
		const harness = createHarness([createMatcher("run")]);
		await annotateOnce(harness);

		block.querySelector("em")?.remove();
		harness.flushMutations();

		expect(harness.isVisibilityObserved(block)).toBe(true);
	});

	it("keeps page changes from a delivery that also holds its own replacements", async () => {
		const annotated = mountBlock("<p>I run daily.</p>");
		const other = mountBlock("<p>Nothing here.</p>");
		const harness = createHarness([createMatcher("run")]);
		await startAndReveal(harness);

		glossEach(harness.translations[0]);
		await settle();
		other.append(" More text.");
		harness.flushMutations();

		expect(harness.isVisibilityObserved(other)).toBe(true);
		expect(harness.isVisibilityObserved(annotated)).toBe(false);
	});

	it("leaves blocks alone when only their container's children change", async () => {
		const block = mountBlock("<p>I run daily.</p>");
		const harness = createHarness([createMatcher("run")]);
		await annotateOnce(harness);

		block.parentElement?.append(document.createElement("hr"), "tail");
		harness.flushMutations();

		expect(harness.isVisibilityObserved(block)).toBe(false);
	});

	it("scans every block inside an added subtree", async () => {
		mountBlock("<p>I run daily.</p>");
		const harness = createHarness([createMatcher("run")]);
		await annotateOnce(harness);

		const section = mountBlock("<section><p>We run too.</p></section>");
		const paragraph = section.querySelector("p");
		if (paragraph === null) {
			throw new Error("Markup is missing its paragraph.");
		}
		harness.flushMutations();

		expect(harness.isVisibilityObserved(section)).toBe(true);
		expect(harness.isVisibilityObserved(paragraph)).toBe(true);
	});

	it("treats a later move of its glosses as a page change", async () => {
		const source = mountBlock("<p>I run daily.</p>");
		const target = mountBlock("<p>Moved here:</p>");
		const harness = createHarness([createMatcher("run")]);
		await annotateOnce(harness);

		const gloss = source.querySelector("span");
		if (gloss === null) {
			throw new Error("Expected a rendered gloss.");
		}
		target.append(gloss);
		harness.flushMutations();

		expect(harness.isVisibilityObserved(source)).toBe(true);
		expect(harness.isVisibilityObserved(target)).toBe(true);
	});
});

describe("annotator runtime staleness", () => {
	it("applies an invalidation that arrives while boot builds its matcher", async () => {
		mountBlock("<p>I run and walk.</p>");
		const harness = createHarness([
			createMatcher("run"),
			createMatcher("run", "walk"),
		]);

		await Promise.all([harness.runtime.start(), harness.runtime.invalidate()]);
		await harness.reveal();

		expect(harness.translations.map((call) => call.input.words)).toStrictEqual([
			["run", "walk"],
		]);
	});

	it("drops a result that an invalidation made stale and asks again", async () => {
		const block = mountBlock("<p>I run and walk.</p>");
		const harness = createHarness([
			createMatcher("run"),
			createMatcher("run", "walk"),
		]);
		await startAndReveal(harness);

		await harness.runtime.invalidate();
		glossEach(harness.translations[0]);
		await settle();
		expect(block.textContent).toBe("I run and walk.");
		expect(harness.isVisibilityObserved(block)).toBe(true);

		await harness.reveal();
		glossEach(harness.translations[1]);
		await settle();

		expect(harness.translations[1]?.input.words).toStrictEqual(["run", "walk"]);
		expect(block.textContent).toBe("I run(run-zh) and walk(walk-zh).");
	});

	it("drops a result for a block the page changed mid-request", async () => {
		const block = mountBlock("<p>I run daily.</p>");
		const harness = createHarness([createMatcher("run")]);
		await startAndReveal(harness);

		block.append(" We run again.");
		harness.flushMutations();
		expect(harness.isVisibilityObserved(block)).toBe(false);

		glossEach(harness.translations[0]);
		await settle();
		expect(block.textContent).toBe("I run daily. We run again.");
		expect(harness.isVisibilityObserved(block)).toBe(true);

		await harness.reveal();
		expect(harness.translations[1]?.input.paragraph).toBe(
			"I run daily. We run again.",
		);
	});

	it("renders nothing into a document switched to design mode mid-request", async () => {
		const block = mountBlock("<p>I run daily.</p>");
		const harness = createHarness([createMatcher("run")]);
		await startAndReveal(harness);

		document.designMode = "on";
		glossEach(harness.translations[0]);
		await settle();

		expect(block.textContent).toBe("I run daily.");
	});

	it("renders nothing and observes nothing once disposed mid-request", async () => {
		const block = mountBlock("<p>I run daily.</p>");
		const harness = createHarness([createMatcher("run")]);
		await startAndReveal(harness);
		const observeCountBefore = harness.observeCount();

		harness.runtime.dispose();
		glossEach(harness.translations[0]);
		await settle();

		expect(block.textContent).toBe("I run daily.");
		expect(harness.observeCount()).toBe(observeCountBefore);
		expect(harness.translations).toHaveLength(1);
	});

	it("drops queued blocks with the running ones on dispose", async () => {
		const blocks = Array.from({ length: 5 }, (_, index) =>
			mountBlock(`<p>Block ${index}: we run.</p>`),
		);
		const harness = createHarness([createMatcher("run")]);
		await startAndReveal(harness);
		expect(harness.translations).toHaveLength(3);

		harness.runtime.dispose();
		for (const call of harness.translations) {
			glossEach(call);
		}
		await settle();

		expect(harness.translations).toHaveLength(3);
		expect(
			blocks.filter((block) => block.querySelector("span") !== null),
		).toStrictEqual([]);
	});
});
