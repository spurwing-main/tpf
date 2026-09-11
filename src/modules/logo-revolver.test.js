import { beforeEach, describe, expect, it, vi } from "vitest";
import { initLogoRevolver, LOGO_REVOLVER_DEFAULTS, partitionLogos } from "./logo-revolver.js";

describe("partitionLogos", () => {
	it("round-robins six logos across two slots", () => {
		expect(partitionLogos(["a", "b", "c", "d", "e", "f"], 2)).toEqual([
			["a", "c", "e"],
			["b", "d", "f"],
		]);
	});

	it("never creates more slots than valid logos", () => {
		expect(partitionLogos(["a"], 2)).toEqual([["a"]]);
		expect(partitionLogos([], 2)).toEqual([]);
		expect(partitionLogos(["a", "b"], 0)).toEqual([]);
	});
});
