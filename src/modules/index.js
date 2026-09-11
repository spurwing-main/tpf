import { initAccordions } from "./accordions.js";
import { initSliders } from "./sliders.js";
import { initTestimonials } from "./testimonials.js";
import { initNav } from "./nav.js";
import { initStats } from "./stats.js";
import { initValues } from "./values.js";
import { initLogoRevolver } from "./logo-revolver.js";

// Import each module here. Keep the start order explicit.
export const modules = [
	{ name: "nav", init: initNav },
	{ name: "logoRevolver", init: initLogoRevolver },
	{ name: "sliders", init: initSliders },
	{ name: "testimonials", init: initTestimonials },
	{ name: "accordions", init: initAccordions },
	{ name: "values", init: initValues },
	{ name: "stats", init: initStats },
];
