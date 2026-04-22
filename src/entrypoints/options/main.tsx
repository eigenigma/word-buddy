import { render } from "preact";

import { App } from "./App";
import "virtual:uno.css";

const rootElement = document.querySelector<HTMLElement>("#wb-options-root");

if (!rootElement) {
	throw new Error("Missing #wb-options-root.");
}

render(<App />, rootElement);
