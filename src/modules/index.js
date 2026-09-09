import { initAccordions } from "./accordions.js";
import { initCardSlider } from "./card-slider.js";
import { initNav } from "./nav.js";
import { initValues } from "./values.js";

// Import each module here. Keep the start order explicit.
export const modules = [
	{ name: "nav", init: initNav },
	{ name: "cardSlider", init: initCardSlider },
	{ name: "accordions", init: initAccordions },
	{ name: "values", init: initValues },
];
