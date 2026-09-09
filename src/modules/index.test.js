import { describe, expect, it } from "vitest";
import { initAccordions } from "./accordions.js";
import { modules } from "./index.js";

describe("module registry", () => {
	it("registers the accordion initializer with the site boot sequence", () => {
		expect(modules).toContainEqual({ name: "accordions", init: initAccordions });
	});
});
