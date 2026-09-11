import { beforeEach, describe, expect, it } from "vitest";
import { initSliders } from "./sliders.js";

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

function splideMarkup(attributes = "") {
	return `<section class="splide" ${attributes}><div class="splide__track"><ul class="splide__list"></ul></div></section>`;
}

describe("initSliders", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		SplideDouble.instances = [];
	});

	it("mounts every splide with the default options", () => {
		document.body.innerHTML = `
			${splideMarkup()}
			${splideMarkup('data-component="unrelated"')}
		`;

		initSliders(document, SplideDouble);

		expect(
			[...document.querySelectorAll(".card-slider")].every((slider) =>
				slider.hasAttribute("data-slider-mounted"),
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
			},
		]);
	});

	it("uses boolean data attributes to configure each slider", () => {
		document.body.innerHTML = `
			${splideMarkup('data-splide-arrows="true" data-splide-loop="true" data-splide-pagination="true"')}
			${splideMarkup('data-splide-arrows="false" data-splide-loop="false" data-splide-pagination="false"')}
		`;

		initSliders(document, SplideDouble);

		expect(SplideDouble.instances.map(({ options }) => options)).toEqual([
			expect.objectContaining({ type: "loop", arrows: true, pagination: true }),
			expect.objectContaining({ type: "slide", arrows: false, pagination: false }),
		]);
	});

	it("skips splide elements without the required track and list markup", () => {
		document.body.innerHTML = `
			<section class="splide"></section>
			${splideMarkup()}
		`;

		initSliders(document, SplideDouble);

		expect(SplideDouble.instances).toHaveLength(1);
		expect(SplideDouble.instances[0].element).toBe(
			document.querySelector(".splide__track").parentElement,
		);
	});

	it("leaves testimonial splides for the testimonial initializer", () => {
		document.body.innerHTML = `
			${splideMarkup('data-testimonials="root"')}
			${splideMarkup('data-testimonials="nav"')}
			${splideMarkup('data-component="ordinary"')}
		`;

		initSliders(document, SplideDouble);

		expect(SplideDouble.instances).toHaveLength(1);
		expect(SplideDouble.instances[0].element.dataset.component).toBe("ordinary");
	});

	it("destroys every mounted slider during cleanup", () => {
		document.body.innerHTML = splideMarkup();

		const cleanup = initSliders(document, SplideDouble);
		cleanup();

		expect(SplideDouble.instances[0].destroyed).toBe(true);
		expect(document.querySelector(".splide").hasAttribute("data-slider-mounted")).toBe(false);
	});
});
