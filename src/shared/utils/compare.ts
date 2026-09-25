// Locale-independent, so anything sorted with it (generated assets, hash
// inputs) comes out the same on every machine. Unlike the default UTF-16
// code-unit order, astral characters sort after U+E000..U+FFFF.
export function compareCodePoints(left: string, right: string): number {
	let index = 0;

	for (;;) {
		const leftCodePoint = left.codePointAt(index);
		const rightCodePoint = right.codePointAt(index);

		if (leftCodePoint === undefined || rightCodePoint === undefined) {
			return left.length - right.length;
		}

		if (leftCodePoint !== rightCodePoint) {
			return leftCodePoint - rightCodePoint;
		}

		index += leftCodePoint > 0xffff ? 2 : 1;
	}
}
