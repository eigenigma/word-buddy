// jsdom has no layout, so it has no checkVisibility either.
const ORIGINAL_CHECK_VISIBILITY = Object.getOwnPropertyDescriptor(
	Element.prototype,
	"checkVisibility",
);

export function stubCheckVisibility(
	isVisible: (element: Element) => boolean,
): void {
	Object.defineProperty(Element.prototype, "checkVisibility", {
		configurable: true,
		value: function checkVisibility(this: Element): boolean {
			return isVisible(this);
		},
	});
}

export function restoreCheckVisibility(): void {
	if (ORIGINAL_CHECK_VISIBILITY) {
		Object.defineProperty(
			Element.prototype,
			"checkVisibility",
			ORIGINAL_CHECK_VISIBILITY,
		);
	} else {
		Reflect.deleteProperty(Element.prototype, "checkVisibility");
	}
}
