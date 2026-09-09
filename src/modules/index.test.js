import { describe, expect, it } from "vitest";
import { initAccordions } from "./accordions.js";
import { modules } from "./index.js";
import { initValues } from "./values.js";

describe("module registry", () => {
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
});
