export interface Timers {
	readonly clearTimeout: (timerId: number) => void;
	readonly setTimeout: (callback: () => void, delay: number) => number;
}
