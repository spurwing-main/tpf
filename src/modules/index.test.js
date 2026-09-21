import { describe, expect, it, vi } from "vitest";
import { initAccordions } from "./accordions.js";
import { modules } from "./index.js";
import { initLogoRevolver } from "./logo-revolver.js";
import { initDialogs } from "./dialogs.js";
import { initStats } from "./stats.js";
import { initTestimonials } from "./testimonials.js";
import { initPanelStack } from "./panel-stack.js";
import { initVideos } from "./videos.js";
import { initFaqSchema } from "./faq-schema.js";
import { initWhatsapp } from "./whatsapp.js";
import { initWhatsappPin } from "./whatsapp-pin.js";
import { initApplicationForms } from "./application-form.js";

vi.mock("plyr", () => ({ default: class PlyrDefaultDouble {} }));

describe("module registry", () => {
	it("registers the native dialog initializer", () => {
		expect(modules).toContainEqual({ name: "dialogs", init: initDialogs });
	});

	it("registers the mobile client logo revolver", () => {
		expect(modules).toContainEqual({ name: "logoRevolver", init: initLogoRevolver });
	});

	it("registers the accordion initializer with the site boot sequence", () => {
		expect(modules).toContainEqual({ name: "accordions", init: initAccordions });
	});

	it("starts panel stacks after accordions so initial open state is available", () => {
		const accordionIndex = modules.findIndex(({ init }) => init === initAccordions);
		const panelStackIndex = modules.findIndex(({ init }) => init === initPanelStack);

		expect(accordionIndex).toBeGreaterThanOrEqual(0);
		expect(panelStackIndex).toBe(accordionIndex + 1);
		expect(modules[panelStackIndex]).toEqual({ name: "panelStack", init: initPanelStack });
	});

	it("registers the stats initializer with the site boot sequence", () => {
		expect(modules).toContainEqual({ name: "stats", init: initStats });
	});

	it("registers the video initializer with the site boot sequence", () => {
		expect(modules).toContainEqual({ name: "videos", init: initVideos });
	});

	it("registers the FAQ schema initializer with the site boot sequence", () => {
		expect(modules).toContainEqual({ name: "faqSchema", init: initFaqSchema });
	});

	it("registers the WhatsApp initializer with the site boot sequence", () => {
		expect(modules).toContainEqual({ name: "whatsapp", init: initWhatsapp });
	});

	it("registers the WhatsApp pin initializer with the site boot sequence", () => {
		expect(modules).toContainEqual({ name: "whatsappPin", init: initWhatsappPin });
	});

	it("registers the application form initializer with the site boot sequence", () => {
		expect(modules).toContainEqual({ name: "applicationForms", init: initApplicationForms });
	});

	it("registers the custom testimonial initializer after generic sliders", () => {
		const slidersIndex = modules.findIndex(({ name }) => name === "sliders");
		const testimonialsIndex = modules.findIndex(({ init }) => init === initTestimonials);

		expect(testimonialsIndex).toBe(slidersIndex + 1);
		expect(modules[testimonialsIndex]).toEqual({
			name: "testimonials",
			init: initTestimonials,
		});
	});
});
