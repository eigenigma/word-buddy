// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { extractContainingSentence } from "./sentence";

const ORIGINAL_SEGMENTER = Object.getOwnPropertyDescriptor(Intl, "Segmenter");

function restoreSegmenter(): void {
	if (ORIGINAL_SEGMENTER) {
		Object.defineProperty(Intl, "Segmenter", ORIGINAL_SEGMENTER);
	} else {
		Reflect.deleteProperty(Intl, "Segmenter");
	}
}

afterEach(() => {
	restoreSegmenter();
	vi.restoreAllMocks();
});

describe("extractContainingSentence", () => {
	it("returns an empty string when the block text is blank", () => {
		expect(extractContainingSentence("   ", "agenda")).toBe("");
	});

	it("returns the normalized block text when the selection is blank", () => {
		expect(extractContainingSentence("First\n\n sentence.", "   ")).toBe(
			"First sentence.",
		);
	});

	it("uses Intl.Segmenter when it is available", () => {
		const segmentMock = vi
			.fn()
			.mockReturnValue([
				{ segment: "First sentence. " },
				{ segment: "Second agenda sentence!" },
			]);
		const segmenterConstructorSpy = vi.fn();
		class FakeSegmenter {
			public constructor(locale: string, options: { granularity: string }) {
				segmenterConstructorSpy(locale, options);
			}

			public segment = segmentMock;
		}
		Object.defineProperty(Intl, "Segmenter", {
			configurable: true,
			value: FakeSegmenter,
		});

		const sentence = extractContainingSentence(
			"First sentence. Second agenda sentence!",
			"agenda",
			"en-GB",
		);

		expect(sentence).toBe("Second agenda sentence!");
		expect(segmenterConstructorSpy).toHaveBeenCalledWith("en-GB", {
			granularity: "sentence",
		});
		expect(segmentMock).toHaveBeenCalledWith(
			"First sentence. Second agenda sentence!",
		);
	});

	it("falls back to regex splitting when Intl.Segmenter is unavailable", () => {
		Object.defineProperty(Intl, "Segmenter", {
			configurable: true,
			value: undefined,
		});

		const sentence = extractContainingSentence(
			"First sentence. Another agenda sentence! Final sentence?",
			"agenda",
		);

		expect(sentence).toBe("Another agenda sentence!");
	});

	it("returns the normalized block text when no sentence contains the selection", () => {
		const sentence = extractContainingSentence(
			"First sentence. Another sentence!",
			"agenda",
		);

		expect(sentence).toBe("First sentence. Another sentence!");
	});
});
