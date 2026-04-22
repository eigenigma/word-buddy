export interface PatternRef {
	readonly lemma: string;
	readonly surface: string;
}

export interface AhoCorasickMatch {
	readonly end: number;
	readonly lemma: string;
	readonly start: number;
	readonly surface: string;
}

export interface AhoCorasickMatcher {
	readonly findAll: (text: string) => readonly AhoCorasickMatch[];
	readonly patternCount: number;
}

interface StoredPattern {
	readonly lemma: string;
	readonly length: number;
	readonly surface: string;
}

interface AutomatonNode {
	failure: number;
	readonly outputs: StoredPattern[];
	readonly transitions: Map<number, number>;
}

const WORD_CHARACTER_PATTERN = /[a-z0-9'-]/u;

function createAutomatonNode(): AutomatonNode {
	return {
		failure: 0,
		outputs: [],
		transitions: new Map<number, number>(),
	};
}

function getAutomatonNode(
	nodes: readonly AutomatonNode[],
	state: number,
): AutomatonNode {
	const node = nodes[state];
	if (node === undefined) {
		throw new Error(`Missing automaton state ${state}.`);
	}

	return node;
}

function toLowercaseSurface(surface: string): string {
	return surface.toLowerCase();
}

function normalizePatterns(
	patterns: readonly PatternRef[],
): readonly StoredPattern[] {
	if (patterns.length === 0) {
		throw new Error("Aho-Corasick matcher requires at least one pattern.");
	}

	const dedupeKeys = new Set<string>();
	const normalizedPatterns: StoredPattern[] = [];

	for (const pattern of patterns) {
		const surface = toLowercaseSurface(pattern.surface);
		if (surface.length === 0) {
			throw new Error("Aho-Corasick patterns must not be empty.");
		}

		const dedupeKey = `${pattern.lemma}\u001f${surface}`;
		if (dedupeKeys.has(dedupeKey)) {
			continue;
		}

		dedupeKeys.add(dedupeKey);
		normalizedPatterns.push({
			lemma: pattern.lemma,
			length: surface.length,
			surface: surface,
		});
	}

	if (normalizedPatterns.length === 0) {
		throw new Error("Aho-Corasick matcher requires at least one pattern.");
	}

	return normalizedPatterns;
}

function ensureTransition(
	nodes: AutomatonNode[],
	state: number,
	charCode: number,
): number {
	const stateNode = getAutomatonNode(nodes, state);
	const nextState = stateNode.transitions.get(charCode);
	if (nextState !== undefined) {
		return nextState;
	}

	const createdState = nodes.length;
	stateNode.transitions.set(charCode, createdState);
	nodes.push(createAutomatonNode());
	return createdState;
}

function appendPattern(nodes: AutomatonNode[], pattern: StoredPattern): void {
	let state = 0;

	for (let index = 0; index < pattern.surface.length; index += 1) {
		state = ensureTransition(nodes, state, pattern.surface.charCodeAt(index));
	}

	getAutomatonNode(nodes, state).outputs.push(pattern);
}

function seedFailureQueue(nodes: readonly AutomatonNode[]): number[] {
	const queue: number[] = [];
	const rootNode = getAutomatonNode(nodes, 0);

	for (const nextState of rootNode.transitions.values()) {
		queue.push(nextState);
	}

	return queue;
}

function resolveFailureState(
	nodes: readonly AutomatonNode[],
	state: number,
	charCode: number,
): number {
	let failureState = state;

	while (
		failureState !== 0 &&
		!getAutomatonNode(nodes, failureState).transitions.has(charCode)
	) {
		failureState = getAutomatonNode(nodes, failureState).failure;
	}

	return getAutomatonNode(nodes, failureState).transitions.get(charCode) ?? 0;
}

function mergeFailureOutputs(
	nodes: readonly AutomatonNode[],
	targetState: number,
): void {
	const targetNode = getAutomatonNode(nodes, targetState);
	const failureNode = getAutomatonNode(nodes, targetNode.failure);

	for (const output of failureNode.outputs) {
		targetNode.outputs.push(output);
	}
}

function buildAutomaton(
	patterns: readonly StoredPattern[],
): readonly AutomatonNode[] {
	const nodes: AutomatonNode[] = [createAutomatonNode()];

	for (const pattern of patterns) {
		appendPattern(nodes, pattern);
	}

	const queue = seedFailureQueue(nodes);
	for (const nextState of queue) {
		getAutomatonNode(nodes, nextState).failure = 0;
	}

	for (const state of queue) {
		const stateNode = getAutomatonNode(nodes, state);
		for (const [charCode, nextState] of stateNode.transitions) {
			const nextNode = getAutomatonNode(nodes, nextState);
			nextNode.failure = resolveFailureState(
				nodes,
				stateNode.failure,
				charCode,
			);
			mergeFailureOutputs(nodes, nextState);
			queue.push(nextState);
		}
	}

	return nodes;
}

function isWordCharacter(character: string | undefined): boolean {
	if (character === undefined) {
		return false;
	}

	return WORD_CHARACTER_PATTERN.test(character.toLowerCase());
}

export function createAhoCorasickMatcher(
	patterns: readonly PatternRef[],
): AhoCorasickMatcher {
	const normalizedPatterns = normalizePatterns(patterns);
	const automaton = buildAutomaton(normalizedPatterns);

	return {
		findAll: (text: string): readonly AhoCorasickMatch[] => {
			const loweredText = text.toLowerCase();
			const matches: AhoCorasickMatch[] = [];
			let state = 0;

			for (let index = 0; index < loweredText.length; index += 1) {
				const charCode = loweredText.charCodeAt(index);

				while (
					state !== 0 &&
					!getAutomatonNode(automaton, state).transitions.has(charCode)
				) {
					state = getAutomatonNode(automaton, state).failure;
				}

				const nextState = getAutomatonNode(automaton, state).transitions.get(
					charCode,
				);
				if (nextState === undefined) {
					state = 0;
					continue;
				}

				state = nextState;
				for (const pattern of getAutomatonNode(automaton, state).outputs) {
					matches.push({
						end: index + 1,
						lemma: pattern.lemma,
						start: index - pattern.length + 1,
						surface: pattern.surface,
					});
				}
			}

			return matches;
		},
		patternCount: normalizedPatterns.length,
	};
}

export function isWholeWordMatch(
	text: string,
	start: number,
	end: number,
): boolean {
	const previousCharacter = start > 0 ? text[start - 1] : undefined;
	const nextCharacter = end < text.length ? text[end] : undefined;

	return !(
		isWordCharacter(previousCharacter) || isWordCharacter(nextCharacter)
	);
}
