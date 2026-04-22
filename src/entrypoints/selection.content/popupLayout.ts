const BUBBLE_GAP = 8;
const BUBBLE_SIZE = 40;
const POPUP_GAP = 6;
const POPUP_HEIGHT = 240;
const POPUP_VIEWPORT_PADDING = 8;
const POPUP_WIDTH = 320;

export interface PopupCoordinates {
	readonly left: number;
	readonly top: number;
}

export interface ViewportDimensions {
	readonly height: number;
	readonly width: number;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

export function computeBubbleCoordinates(
	rect: DOMRectReadOnly,
	viewport: ViewportDimensions,
): PopupCoordinates {
	const centeredLeft = rect.left + rect.width / 2 - BUBBLE_SIZE / 2;
	const maxLeft = viewport.width - BUBBLE_SIZE - POPUP_VIEWPORT_PADDING;
	const fitsAbove =
		rect.top - BUBBLE_SIZE - BUBBLE_GAP >= POPUP_VIEWPORT_PADDING;
	const preferredTop = fitsAbove
		? rect.top - BUBBLE_SIZE - BUBBLE_GAP
		: rect.bottom + BUBBLE_GAP;
	const maxTop = viewport.height - BUBBLE_SIZE - POPUP_VIEWPORT_PADDING;

	return {
		left: clamp(
			centeredLeft,
			POPUP_VIEWPORT_PADDING,
			Math.max(POPUP_VIEWPORT_PADDING, maxLeft),
		),
		top: clamp(
			preferredTop,
			POPUP_VIEWPORT_PADDING,
			Math.max(POPUP_VIEWPORT_PADDING, maxTop),
		),
	};
}

export function computePopupCoordinates(
	rect: DOMRectReadOnly,
	viewport: ViewportDimensions,
): PopupCoordinates {
	const maxLeft = viewport.width - POPUP_WIDTH - POPUP_VIEWPORT_PADDING;
	const fitsOnRight =
		rect.right + POPUP_GAP + POPUP_WIDTH <=
		viewport.width - POPUP_VIEWPORT_PADDING;
	const fitsOnLeft =
		rect.left - POPUP_GAP - POPUP_WIDTH >= POPUP_VIEWPORT_PADDING;
	const preferredLeft =
		!fitsOnRight && fitsOnLeft
			? rect.left - POPUP_WIDTH - POPUP_GAP
			: rect.right + POPUP_GAP;
	const left = clamp(
		preferredLeft,
		POPUP_VIEWPORT_PADDING,
		Math.max(POPUP_VIEWPORT_PADDING, maxLeft),
	);
	const shouldFlipAbove =
		rect.bottom + POPUP_HEIGHT + POPUP_GAP > viewport.height;
	const preferredTop = shouldFlipAbove
		? rect.top - POPUP_HEIGHT - POPUP_GAP
		: rect.bottom + POPUP_GAP;
	const maxTop = viewport.height - POPUP_HEIGHT - POPUP_VIEWPORT_PADDING;
	const top = clamp(
		preferredTop,
		POPUP_VIEWPORT_PADDING,
		Math.max(POPUP_VIEWPORT_PADDING, maxTop),
	);

	return {
		left: left,
		top: top,
	};
}
