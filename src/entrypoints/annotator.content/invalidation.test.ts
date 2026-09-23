import { describe, expect, it, type Mock, vi } from "vitest";

import {
	createInvalidationController,
	type InvalidationController,
} from "./invalidation";

interface Harness {
	readonly controller: InvalidationController;
	readonly rebuildMatcher: Mock<() => Promise<void>>;
	readonly releaseFirstRebuild: () => void;
	readonly rescanDocument: Mock<() => void>;
}

function createHarness(): Harness {
	const firstRebuild = Promise.withResolvers<void>();
	const rebuildMatcher = vi
		.fn<() => Promise<void>>()
		.mockReturnValueOnce(firstRebuild.promise)
		.mockResolvedValue(undefined);
	const rescanDocument = vi.fn<() => void>();

	return {
		controller: createInvalidationController({
			rebuildMatcher: rebuildMatcher,
			rescanDocument: rescanDocument,
		}),
		rebuildMatcher: rebuildMatcher,
		releaseFirstRebuild: firstRebuild.resolve,
		rescanDocument: rescanDocument,
	};
}

describe("createInvalidationController", () => {
	it("rebuilds the matcher and rescans once per invalidation", async () => {
		const harness = createHarness();

		const invalidation = harness.controller.onInvalidate();
		harness.releaseFirstRebuild();
		await invalidation;

		expect(harness.rebuildMatcher).toHaveBeenCalledTimes(1);
		expect(harness.rescanDocument).toHaveBeenCalledTimes(1);
	});

	it("runs a fresh cycle for an invalidation after the previous one settled", async () => {
		const harness = createHarness();

		const first = harness.controller.onInvalidate();
		harness.releaseFirstRebuild();
		await first;
		await harness.controller.onInvalidate();

		expect(harness.rebuildMatcher).toHaveBeenCalledTimes(2);
		expect(harness.rescanDocument).toHaveBeenCalledTimes(2);
	});

	it("coalesces invalidations that arrive mid-rebuild into one rerun", async () => {
		const harness = createHarness();

		const first = harness.controller.onInvalidate();
		const second = harness.controller.onInvalidate();
		const third = harness.controller.onInvalidate();
		expect(harness.rebuildMatcher).toHaveBeenCalledTimes(1);

		harness.releaseFirstRebuild();
		await Promise.all([first, second, third]);

		expect(harness.rebuildMatcher).toHaveBeenCalledTimes(2);
		expect(harness.rescanDocument).toHaveBeenCalledTimes(2);
	});

	it("stops without rescanning when disposed mid-rebuild", async () => {
		const harness = createHarness();

		const first = harness.controller.onInvalidate();
		const second = harness.controller.onInvalidate();
		harness.controller.dispose();
		harness.releaseFirstRebuild();
		await Promise.all([first, second]);

		expect(harness.rebuildMatcher).toHaveBeenCalledTimes(1);
		expect(harness.rescanDocument).not.toHaveBeenCalled();
	});

	it("ignores invalidations after dispose", async () => {
		const harness = createHarness();

		harness.controller.dispose();
		await harness.controller.onInvalidate();

		expect(harness.rebuildMatcher).not.toHaveBeenCalled();
		expect(harness.rescanDocument).not.toHaveBeenCalled();
	});
});
