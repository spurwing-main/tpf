import { initAccordions } from "./accordions.js";
import { initSliders } from "./sliders.js";
import { initTestimonials } from "./testimonials.js";
import { initNav } from "./nav.js";
import { initNavScrollState } from "./nav-scroll.js";
import { initStats } from "./stats.js";
import { initPanelStack } from "./panel-stack.js";
import { initLogoRevolver } from "./logo-revolver.js";
import { initDialogs } from "./dialogs.js";
import { initVideos } from "./videos.js";
import { initFaqSchema } from "./faq-schema.js";
import { initWhatsapp } from "./whatsapp.js";
import { initWhatsappPin } from "./whatsapp-pin.js";
import { initApplicationForms } from "./application-form.js";

// Import each module here. Keep the start order explicit.
export const modules = [
	{ name: "dialogs", init: initDialogs },
	{ name: "nav", init: initNav },
	{ name: "navScroll", init: initNavScrollState },
	{ name: "logoRevolver", init: initLogoRevolver },
	{ name: "sliders", init: initSliders },
	{ name: "testimonials", init: initTestimonials },
	{ name: "accordions", init: initAccordions },
	{ name: "panelStack", init: initPanelStack },
	{ name: "stats", init: initStats },
	{ name: "videos", init: initVideos },
	{ name: "faqSchema", init: initFaqSchema },
	{ name: "whatsapp", init: initWhatsapp },
	{ name: "whatsappPin", init: initWhatsappPin },
	{ name: "applicationForms", init: initApplicationForms },
];
