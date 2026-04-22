export interface WalkableNode {
	readonly attributes?: Readonly<Record<string, string>>;
	readonly children: readonly WalkableNode[];
	readonly kind: "element" | "text";
	readonly tagName?: string;
	readonly textContent?: string;
}

export interface WalkableTextNode {
	readonly node: WalkableNode;
	readonly paragraphKey: string;
	readonly paragraphText: string;
	readonly text: string;
}
