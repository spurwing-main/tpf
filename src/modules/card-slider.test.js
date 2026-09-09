import { beforeEach, describe, expect, it } from "vitest";
import { initCardSlider } from "./card-slider.js";

class SplideDouble {
	static instances = [];

	constructor(element, options) {
		this.element = element;
		this.options = options;
		this.mounted = false;
		this.destroyed = false;
		SplideDouble.instances.push(this);
	}

	mount() {
		this.mounted = true;
		this.element.dataset.sliderMounted = "";
		return this;
	}

	destroy() {
		this.destroyed = true;
		delete this.element.dataset.sliderMounted;
	}
}

describe("initCardSlider", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		SplideDouble.instances = [];
	});

	it("mounts each card slider with CSS sizing and mobile pagination", () => {
		document.body.innerHTML = `
			<section class="card-slider splide"></section>
			<section class="card-slider splide"></section>
		`;

		initCardSlider(document, SplideDouble);

		expect(
			[...document.querySelectorAll(".card-slider")].every(
				(slider) => slider.hasAttribute("data-slider-mounted"),
			),
		).toBe(true);
		expect(SplideDouble.instances.map(({ options }) => options)).toEqual([
			{
				type: "slide",
				autoWidth: true,
				arrows: false,
				pagination: false,
				drag: true,
				snap: true,
				rewind: false,
				trimSpace: true,
				mediaQuery: "max",
				breakpoints: { 767: { pagination: true } },
			},
			{
				type: "slide",
				autoWidth: true,
				arrows: false,
				pagination: false,
				drag: true,
				snap: true,
				rewind: false,
				trimSpace: true,
				mediaQuery: "max",
				breakpoints: { 767: { pagination: true } },
			},
		]);
	});

	it("destroys every mounted slider during cleanup", () => {
		document.body.innerHTML = '<section class="card-slider splide"></section>';

		const cleanup = initCardSlider(document, SplideDouble);
		cleanup();

		expect(SplideDouble.instances[0].destroyed).toBe(true);
		expect(document.querySelector(".card-slider").hasAttribute("data-slider-mounted")).toBe(false);
	});
});
