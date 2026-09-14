import { initAccordions } from "./accordions.js";
import { initSliders } from "./sliders.js";
import { initTestimonials } from "./testimonials.js";
import { initNav } from "./nav.js";
import { initNavScrollState } from "./nav-scroll.js";
import { initStats } from "./stats.js";
import { initValues } from "./values.js";
import { initLogoRevolver } from "./logo-revolver.js";
import { initDialogs } from "./dialogs.js";
import { initVideos } from "./videos.js";

// Import each module here. Keep the start order explicit.
export const modules = [
	{ name: "dialogs", init: initDialogs },
	{ name: "nav", init: initNav },
	{ name: "navScroll", init: initNavScrollState },
	{ name: "logoRevolver", init: initLogoRevolver },
	{ name: "sliders", init: initSliders },
	{ name: "testimonials", init: initTestimonials },
	{ name: "accordions", init: initAccordions },
	{ name: "values", init: initValues },
	{ name: "stats", init: initStats },
	{ name: "videos", init: initVideos },
];
