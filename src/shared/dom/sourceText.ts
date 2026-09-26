import { INJECTED_SELECTOR, INJECTED_WORD_ATTRIBUTE } from "./injectedMarker";

export type TextBoundary = "" | "\t" | "\n";

export type Separator = TextBoundary | " ";

// Source text is the page's own text as it reads: each gloss span contributes
// only its word, whitespace collapses as in normal flow, a pruned element
// leaves only the separator the policy gives it in place of its subtree, `br`
// breaks the line, and every other element adds the boundary the policy gives
// it on both sides.
export interface SourceTextPolicy {
	readonly boundaryAround: (element: Element) => TextBoundary;
	readonly isPruned: (element: Element) => boolean;
	readonly isTextIncluded: (text: Text) => boolean;
	readonly separatorForPruned: (element: Element) => Separator;
}

// Adjacent separators collapse into the strongest.
const SEPARATOR_STRENGTH: Readonly<Record<Separator, number>> = {
	"": 0,
	" ": 1,
	"\t": 2,
	"\n": 3,
};

const HTML_WHITESPACE = /[\t\n\f\r ]+/gu;

interface SourceTextBuilder {
	readonly append: (text: string) => void;
	readonly read: () => string;
	readonly separate: (separator: Separator) => void;
}

interface SourceTextWalk {
	readonly builder: SourceTextBuilder;
	readonly policy: SourceTextPolicy;
	readonly range: Range | null;
}

function strongerSeparator(left: Separator, right: Separator): Separator {
	return SEPARATOR_STRENGTH[left] >= SEPARATOR_STRENGTH[right] ? left : right;
}

function createSourceTextBuilder(): SourceTextBuilder {
	let output = "";
	let pending: Separator = "";

	return {
		append: (text: string): void => {
			const collapsed = text.replaceAll(HTML_WHITESPACE, " ");
			const leadingSpace = collapsed.startsWith(" ");
			const trailingSpace = collapsed.endsWith(" ");
			const words = collapsed.slice(
				leadingSpace ? 1 : 0,
				collapsed.length - (trailingSpace ? 1 : 0),
			);
			if (leadingSpace) {
				pending = strongerSeparator(pending, " ");
			}
			if (words === "") {
				return;
			}

			output += output === "" ? words : pending + words;
			pending = trailingSpace ? " " : "";
		},
		read: (): string => output,
		separate: (separator: Separator): void => {
			pending = strongerSeparator(pending, separator);
		},
	};
}

// A gloss span holds one `word(gloss)` text node (see createGlossSpan), so only
// the word part of that node is source text, and any other text in the span is
// not.
function getSourceEnd(text: Text): number {
	const injected = text.parentElement?.closest(INJECTED_SELECTOR) ?? null;
	if (injected === null) {
		return text.length;
	}
	if (injected.firstChild !== text) {
		return 0;
	}

	return injected.getAttribute(INJECTED_WORD_ATTRIBUTE)?.length ?? 0;
}

function appendText(text: Text, walk: SourceTextWalk): void {
	const { range } = walk;
	const start = range?.startContainer === text ? range.startOffset : 0;
	const end = Math.min(
		range?.endContainer === text ? range.endOffset : text.length,
		getSourceEnd(text),
	);

	if (start < end && walk.policy.isTextIncluded(text)) {
		walk.builder.append(text.data.slice(start, end));
	}
}

function appendNode(node: Node, walk: SourceTextWalk): void {
	if (walk.range !== null && !walk.range.intersectsNode(node)) {
		return;
	}

	if (node instanceof Text) {
		appendText(node, walk);
	} else if (node instanceof Element) {
		appendElement(node, walk);
	}
}

function appendChildren(parent: Node, walk: SourceTextWalk): void {
	for (const child of parent.childNodes) {
		appendNode(child, walk);
	}
}

function appendElement(element: Element, walk: SourceTextWalk): void {
	if (walk.policy.isPruned(element)) {
		walk.builder.separate(walk.policy.separatorForPruned(element));
		return;
	}

	const boundary =
		element.localName === "br" ? "\n" : walk.policy.boundaryAround(element);
	walk.builder.separate(boundary);
	appendChildren(element, walk);
	walk.builder.separate(boundary);
}

function readFrom(
	container: Node,
	policy: SourceTextPolicy,
	range: Range | null,
): string {
	const builder = createSourceTextBuilder();
	const walk: SourceTextWalk = {
		builder: builder,
		policy: policy,
		range: range,
	};

	if (container instanceof Text) {
		appendText(container, walk);
	} else {
		appendChildren(container, walk);
	}

	return builder.read();
}

export function readSourceText(
	root: Element,
	policy: SourceTextPolicy,
): string {
	return readFrom(root, policy, null);
}

export function readRangeSourceText(
	range: Range,
	policy: SourceTextPolicy,
): string {
	return readFrom(range.commonAncestorContainer, policy, range);
}
