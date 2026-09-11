import { describe, expect, it } from "vitest";
import { initAccordions } from "./accordions.js";
import { modules } from "./index.js";
import { initLogoRevolver } from "./logo-revolver.js";
import { initStats } from "./stats.js";
import { initTestimonials } from "./testimonials.js";
import { initValues } from "./values.js";

describe("module registry", () => {
	it("registers the mobile client logo revolver", () => {
		expect(modules).toContainEqual({ name: "logoRevolver", init: initLogoRevolver });
	});

	it("registers the accordion initializer with the site boot sequence", () => {
		expect(modules).toContainEqual({ name: "accordions", init: initAccordions });
	});

	it("starts Values after accordions so initial open state is available", () => {
		const accordionIndex = modules.findIndex(({ init }) => init === initAccordions);
		const valuesIndex = modules.findIndex(({ init }) => init === initValues);

		expect(accordionIndex).toBeGreaterThanOrEqual(0);
		expect(valuesIndex).toBe(accordionIndex + 1);
		expect(modules[valuesIndex]).toEqual({ name: "values", init: initValues });
	});

	it("registers the stats initializer with the site boot sequence", () => {
		expect(modules).toContainEqual({ name: "stats", init: initStats });
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
