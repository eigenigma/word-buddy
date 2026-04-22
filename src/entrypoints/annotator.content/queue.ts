export interface TranslationQueue {
	readonly dispose: () => void;
	readonly enqueue: (task: () => Promise<void>) => void;
}

export function createTranslationQueue(
	maxConcurrent: number,
): TranslationQueue {
	let disposed = false;
	let running = 0;
	const pendingTasks: Array<() => Promise<void>> = [];

	function tick(): void {
		if (disposed) {
			return;
		}

		while (running < maxConcurrent && pendingTasks.length > 0) {
			const task = pendingTasks.shift();
			if (!task) {
				continue;
			}

			running += 1;
			task().finally((): void => {
				running -= 1;
				tick();
			});
		}
	}

	return {
		dispose: (): void => {
			disposed = true;
			pendingTasks.length = 0;
		},
		enqueue: (task: () => Promise<void>): void => {
			if (disposed) {
				return;
			}

			pendingTasks.push(task);
			tick();
		},
	};
}
