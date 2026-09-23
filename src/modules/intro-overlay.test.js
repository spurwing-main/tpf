import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initIntroOverlay } from "./intro-overlay.js";

describe("initIntroOverlay", () => {
	let cleanup;
	let originalGsap;

	beforeEach(() => {
		document.body.innerHTML = '<div data-intro-overlay></div>';
		document.documentElement.classList.remove("tpf-intro-active");
		document.documentElement.removeAttribute("data-intro-reveal-ready");
		cleanup = null;
		originalGsap = window.gsap;
		vi.spyOn(document, "readyState", "get").mockReturnValue("loading");
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback();
			return 1;
		});
		vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
	});

	afterEach(() => {
		cleanup?.();
		window.gsap = originalGsap;
		document.documentElement.classList.remove("tpf-intro-active");
		document.documentElement.removeAttribute("data-intro-reveal-ready");
		vi.restoreAllMocks();
	});

	it("records that the reveal handoff occurred before the overlay finishes", () => {
		let tweenVariables;
		const timeline = {
			kill: vi.fn(),
			progress: vi.fn(() => 0.65),
			to: vi.fn((target, variables) => {
				tweenVariables = variables;
				return timeline;
			}),
		};
		window.gsap = {
			timeline: vi.fn(() => timeline),
		};

		cleanup = initIntroOverlay(document);
		window.dispatchEvent(new Event("load"));
		tweenVariables.onUpdate();

		expect(document.documentElement.hasAttribute("data-intro-reveal-ready")).toBe(true);
	});
});
