export function readRenderedText(element: HTMLElement): string {
	// biome-ignore lint/nursery/useDomNodeTextContent: callers need the text a reader sees; textContent includes hidden and script content and drops rendered line breaks
	return element.innerText;
}
