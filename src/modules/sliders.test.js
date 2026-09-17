import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initSliders } from "./sliders.js";

class SplideDouble {
	static instances = [];

	constructor(element, options) {
		this.element = element;
		this.options = options;
		this.mountArguments = [];
		this.mounted = false;
		this.destroyed = false;
		this.destroyArguments = [];
		SplideDouble.instances.push(this);
	}

	mount(...args) {
		this.mountArguments = args;
		this.mounted = true;
		this.element.dataset.sliderMounted = "";
		return this;
	}

	destroy(...args) {
		this.destroyArguments = args;
		this.destroyed = true;
		delete this.element.dataset.sliderMounted;
	}
}

function splideMarkup(attributes = "", slideCount = 0) {
	const slides = Array.from(
		{ length: slideCount },
		(_, index) => `<li class="splide__slide">Slide ${index + 1}</li>`,
	).join("");

	return `<section class="splide" ${attributes}><div class="splide__track"><ul class="splide__list">${slides}</ul></div></section>`;
}

function createMediaQueryList(matches = false) {
	const listeners = new Set();

	return {
		matches,
		addEventListener: vi.fn((type, listener) => {
			if (type === "change") listeners.add(listener);
		}),
		removeEventListener: vi.fn((type, listener) => {
			if (type === "change") listeners.delete(listener);
		}),
		setMatches(nextMatches) {
			this.matches = nextMatches;
			listeners.forEach((listener) => listener({ matches: nextMatches }));
		},
	};
}

describe("initSliders", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		SplideDouble.instances = [];
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("mounts every splide without a slide minimum with the default options", () => {
		document.body.innerHTML = `
			${splideMarkup()}
			${splideMarkup('data-component="unrelated"')}
		`;

		initSliders(document, SplideDouble);

		expect([...document.querySelectorAll(".splide")].every((slider) =>
			slider.hasAttribute("data-slider-mounted"),
		)).toBe(true);
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

	it("keeps an under-minimum slider static on desktop", () => {
		const mediaQueryList = createMediaQueryList(false);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
		document.body.innerHTML = splideMarkup('data-splide-slide-min="3"', 2);

		initSliders(document, SplideDouble);

		expect(SplideDouble.instances).toHaveLength(0);
		expect(document.querySelector(".splide").hasAttribute("data-slider-mounted")).toBe(false);
	});

	it("mounts a slider with enough slides on desktop", () => {
		const mediaQueryList = createMediaQueryList(false);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
		document.body.innerHTML = splideMarkup('data-splide-slide-min="3"', 3);

		initSliders(document, SplideDouble);

		expect(SplideDouble.instances).toHaveLength(1);
		expect(document.querySelector(".splide").hasAttribute("data-slider-mounted")).toBe(true);
	});

	it("mounts an under-minimum slider on mobile and destroys it on desktop", () => {
		const mediaQueryList = createMediaQueryList(false);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
		document.body.innerHTML = splideMarkup('data-splide-slide-min="3"', 2);

		const cleanup = initSliders(document, SplideDouble);
		mediaQueryList.setMatches(true);

		expect(SplideDouble.instances).toHaveLength(1);
		expect(document.querySelector(".splide").hasAttribute("data-slider-mounted")).toBe(true);

		mediaQueryList.setMatches(false);

		expect(SplideDouble.instances[0].destroyed).toBe(true);
		expect(document.querySelector(".splide").hasAttribute("data-slider-mounted")).toBe(false);
		cleanup();
	});

	it.each([0, 3])("does not mount a mobile-only slider on desktop with %s slides", (slideCount) => {
		const mediaQueryList = createMediaQueryList(false);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
		document.body.innerHTML = splideMarkup("data-splide-mobile-only=\"true\"", slideCount);
		document.querySelector(".splide").classList.add("is-initialized", "is-overflow");

		initSliders(document, SplideDouble);

		expect(SplideDouble.instances).toHaveLength(0);
		const slider = document.querySelector(".splide");
		expect(slider.hasAttribute("data-slider-mounted")).toBe(false);
		expect(slider.classList.contains("is-initialized")).toBe(false);
		expect(slider.classList.contains("is-overflow")).toBe(false);
	});

	it("mounts a mobile-only slider on mobile", () => {
		const mediaQueryList = createMediaQueryList(true);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
		document.body.innerHTML = splideMarkup('data-splide-mobile-only="true"', 1);

		initSliders(document, SplideDouble);

		expect(SplideDouble.instances).toHaveLength(1);
		expect(document.querySelector(".splide").hasAttribute("data-slider-mounted")).toBe(true);
	});

	it("completely destroys a mobile-only slider when returning to desktop", () => {
		const mediaQueryList = createMediaQueryList(true);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
		document.body.innerHTML = splideMarkup('data-splide-mobile-only="true"', 1);

		initSliders(document, SplideDouble);
		mediaQueryList.setMatches(false);

		expect(SplideDouble.instances[0].destroyed).toBe(true);
		expect(SplideDouble.instances[0].destroyArguments).toEqual([true]);
	});

	it("removes residual Splide status classes when a mobile-only slider is destroyed", () => {
		const mediaQueryList = createMediaQueryList(true);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
		document.body.innerHTML = splideMarkup('data-splide-mobile-only="true"', 1);

		initSliders(document, SplideDouble);
		const slider = document.querySelector(".splide");
		slider.classList.add("is-initialized", "is-overflow");
		mediaQueryList.setMatches(false);

		expect(slider.classList.contains("is-initialized")).toBe(false);
		expect(slider.classList.contains("is-overflow")).toBe(false);
	});

	it("keeps a qualifying slider mounted across breakpoint changes", () => {
		const mediaQueryList = createMediaQueryList(false);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
		document.body.innerHTML = splideMarkup('data-splide-slide-min="3"', 3);

		initSliders(document, SplideDouble);
		mediaQueryList.setMatches(true);
		mediaQueryList.setMatches(false);

		expect(SplideDouble.instances).toHaveLength(1);
		expect(SplideDouble.instances[0].destroyed).toBe(false);
	});

	it("reconciles multiple sliders independently", () => {
		const mediaQueryList = createMediaQueryList(false);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
		document.body.innerHTML = `
			${splideMarkup('data-splide-slide-min="3"', 3)}
			${splideMarkup('data-splide-slide-min="3"', 2)}
		`;

		initSliders(document, SplideDouble);
		mediaQueryList.setMatches(true);

		expect(SplideDouble.instances).toHaveLength(2);
		expect(SplideDouble.instances[0].destroyed).toBe(false);
		expect(SplideDouble.instances[1].destroyed).toBe(false);

		mediaQueryList.setMatches(false);

		expect(SplideDouble.instances[0].destroyed).toBe(false);
		expect(SplideDouble.instances[1].destroyed).toBe(true);
	});

	it("falls back to always mounting for invalid slide minimum values", () => {
		const mediaQueryList = createMediaQueryList(false);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
		document.body.innerHTML = [
			undefined,
			"",
			"not-a-number",
			"2.5",
			"0",
			"-1",
		].map((minimum) =>
			splideMarkup(
				minimum === undefined ? "" : `data-splide-slide-min="${minimum}"`,
				2,
			),
		).join("");

		initSliders(document, SplideDouble);

		expect(SplideDouble.instances).toHaveLength(6);
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

	it("mounts autoscroll sliders with the extension and data-attribute options", () => {
		document.body.innerHTML = splideMarkup(
			'data-splide-autoscroll="true" data-splide-autoscroll-speed="2" data-splide-autoscroll-pause-on-hover="false" data-splide-autoscroll-pause-on-focus="false"',
		);

		initSliders(document, SplideDouble);

		expect(SplideDouble.instances[0].options).toEqual(
			expect.objectContaining({
				autoScroll: { speed: 2, pauseOnHover: false, pauseOnFocus: false },
			}),
		);
		expect(SplideDouble.instances[0].mountArguments).toHaveLength(1);
	});

	it("uses the default autoscroll settings when overrides are absent", () => {
		document.body.innerHTML = splideMarkup('data-splide-autoscroll="true"');

		initSliders(document, SplideDouble);

		expect(SplideDouble.instances[0].options.autoScroll).toEqual({
			speed: 1,
			pauseOnHover: true,
			pauseOnFocus: true,
		});
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

	it("removes media listeners and destroys active instances during cleanup", () => {
		const mediaQueryList = createMediaQueryList(false);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQueryList));
		document.body.innerHTML = `
			${splideMarkup('data-splide-slide-min="3"', 3)}
			${splideMarkup('data-splide-slide-min="3"', 2)}
		`;

		const cleanup = initSliders(document, SplideDouble);
		mediaQueryList.setMatches(true);
		cleanup();

		expect(mediaQueryList.removeEventListener).toHaveBeenCalledTimes(2);
		expect(SplideDouble.instances.every((instance) => instance.destroyed)).toBe(true);
	});
});
