import { render } from "preact";

import "virtual:uno.css";
import { App } from "./App";

const rootElement = document.querySelector<HTMLElement>("#wb-popup-root");

if (!rootElement) {
	throw new Error("Missing #wb-popup-root.");
}

render(<App />, rootElement);
