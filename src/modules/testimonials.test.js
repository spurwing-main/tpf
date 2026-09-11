import { beforeEach, describe, expect, it } from "vitest";
import { initTestimonials } from "./testimonials.js";

class SplideDouble {
	static instances = [];

	constructor(element, options) {
		this.element = element;
		this.options = options;
		this.handlers = new Map();
		this.syncedWith = null;
		this.mounted = false;
		this.destroyed = false;
		SplideDouble.instances.push(this);
	}

	on(events, handler) {
		for (const event of events.split(" ")) {
			const handlers = this.handlers.get(event) || [];
			handlers.push(handler);
			this.handlers.set(event, handlers);
		}
		return this;
	}

	emit(event, ...args) {
		for (const handler of this.handlers.get(event) || []) handler(...args);
	}

	sync(other) {
		this.syncedWith = other;
		return this;
	}

	mount() {
		this.mounted = true;
		this.emit("mounted");
		return this;
	}

	destroy() {
		this.destroyed = true;
	}
}

function applyGsapVars(target, vars) {
	if (vars.autoAlpha !== undefined) {
		target.style.opacity = String(vars.autoAlpha);
		target.style.visibility = vars.autoAlpha === 0 ? "hidden" : "inherit";
	}
	if (vars.scaleX !== undefined) target.style.transform = `scaleX(${vars.scaleX})`;
	if (vars.clearProps?.includes("transform")) target.style.removeProperty("transform");
}

function createGsapDouble() {
	const tweens = [];
	const gsap = {
		set(targets, vars) {
			for (const target of Array.isArray(targets) ? targets : [targets]) {
				if (target) applyGsapVars(target, vars);
			}
		},
		fromTo(target, fromVars, toVars) {
			applyGsapVars(target, fromVars);
			applyGsapVars(target, toVars);
			const tween = {
				target,
				fromVars,
				toVars,
				paused: false,
				killed: false,
				pause() {
					this.paused = true;
				},
				resume() {
					this.paused = false;
				},
				kill() {
					this.killed = true;
				},
			};
			tweens.push(tween);
			return tween;
		},
		killTweensOf() {},
	};
	return { gsap, tweens };
}

function testimonialMarkup(count = 5) {
	const slides = Array.from(
		{ length: count },
		(_, index) => `
			<div role="listitem" class="u-display-contents w-dyn-item">
				<div class="testimonials_media"><img data-testimonials="image" alt="" /></div>
				<div class="testimonials_content">
					<div class="testimonials_index">placeholder</div>
					<div class="testimonials_main" data-testimonials="copy">Quote ${index + 1}</div>
				</div>
			</div>`,
	).join("");
	const avatars = Array.from(
		{ length: count },
		(_, index) => `<div role="listitem" class="testimonials-avatar is-active w-dyn-item">${index + 1}</div>`,
	).join("");

	return `
		<div class="testimonials_panel" data-testimonials="root">
			<div class="testimonials_stack">
				<div class="u-display-contents w-dyn-list">
					<div role="list" class="u-display-contents w-dyn-items">${slides}</div>
				</div>
				<div class="testimonials_footer">
					<div class="testimonials_avatars" data-testimonials="nav">
						<div class="testimonials_avatars-track w-dyn-list">
							<div role="list" class="testimonials_avatars-list w-dyn-items">${avatars}</div>
						</div>
					</div>
					<div class="splide__arrows">
						<button class="splide__arrow splide__arrow--prev"></button>
						<button class="splide__arrow splide__arrow--next"></button>
					</div>
				</div>
			</div>
			<div class="testimonials_progress"><div data-testimonials="progress"></div></div>
		</div>`;
}

describe("initTestimonials", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		SplideDouble.instances = [];
	});

	it("mounts synchronized main and avatar carousels from the Webflow CMS wrappers", () => {
		document.body.innerHTML = testimonialMarkup(5);
		const { gsap } = createGsapDouble();

		initTestimonials(document, SplideDouble, gsap);

		expect(SplideDouble.instances).toHaveLength(2);
		const [main, nav] = SplideDouble.instances;
		expect(main.options).toMatchObject({
			type: "fade",
			rewind: true,
			autoplay: true,
			interval: 8000,
			pauseOnFocus: false,
			arrows: true,
			drag: true,
		});
		expect(nav.options).toMatchObject({
			type: "loop",
			fixedWidth: "2rem",
			focus: "center",
			isNavigation: true,
		});
		expect(main.syncedWith).toBe(nav);
		expect(main.element).toBe(document.querySelector(".testimonials_stack"));
		expect(main.mounted).toBe(true);
		expect(nav.mounted).toBe(true);
		expect(document.querySelector("[data-testimonials='root']").classList).not.toContain("splide");
		expect(document.querySelector(".testimonials_stack").classList).toContain("splide");
		expect(document.querySelector(".testimonials_stack .w-dyn-list").classList).toContain(
			"splide__track",
		);
		expect(
			document.querySelectorAll(
				".testimonials_stack > .splide__track > .splide__list > .splide__slide",
			),
		).toHaveLength(5);
		expect(document.querySelectorAll("[data-testimonials='nav'] .splide__slide")).toHaveLength(5);
		expect([...document.querySelectorAll(".testimonials-avatar")].every((avatar) => !avatar.classList.contains("is-active"))).toBe(true);
	});

	it("updates the visible index and autoplay progress from Splide events", () => {
		document.body.innerHTML = testimonialMarkup(5);
		const { gsap } = createGsapDouble();
		initTestimonials(document, SplideDouble, gsap);
		const [main] = SplideDouble.instances;

		main.emit("move", 2, 0, 2);
		main.emit("autoplay:playing", 0.5);

		expect(
			[...document.querySelectorAll(".testimonials_index")].every(
				(index) => index.textContent === "03 / 05",
			),
		).toBe(true);
		expect(document.querySelector("[data-testimonials='progress']").style.transform).toBe(
			"scaleX(0.5)",
		);
	});

	it("starts the incoming quote and image motion before the crossfade completes", () => {
		document.body.innerHTML = testimonialMarkup(5);
		const { gsap, tweens } = createGsapDouble();
		initTestimonials(document, SplideDouble, gsap);
		const [main] = SplideDouble.instances;

		main.emit("move", 1, 0, 1);

		const nextSlide = document.querySelectorAll(
			".testimonials_stack > .splide__track > .splide__list > .splide__slide",
		)[1];
		expect(nextSlide.querySelector("[data-testimonials='copy']").style.opacity).toBe("1");
		expect(tweens.some(({ target, toVars }) => target === nextSlide.querySelector("img") && toVars.duration > 8)).toBe(true);
	});

	it("preserves the outgoing image transform when its motion stops", () => {
		document.body.innerHTML = testimonialMarkup(5);
		const { gsap } = createGsapDouble();
		initTestimonials(document, SplideDouble, gsap);
		const [main] = SplideDouble.instances;
		const outgoingImage = document.querySelector("[data-testimonials='image']");
		outgoingImage.style.transform = "translate(1%, -1%) scale(1.1)";

		main.emit("move", 1, 0, 1);
		main.emit("moved", 1, 0, 1);

		expect(outgoingImage.style.transform).toBe("translate(1%, -1%) scale(1.1)");
	});

	it("disables motion controls that have no purpose for a single CMS item", () => {
		document.body.innerHTML = testimonialMarkup(1);
		const { gsap } = createGsapDouble();

		initTestimonials(document, SplideDouble, gsap);

		expect(SplideDouble.instances).toHaveLength(1);
		expect(SplideDouble.instances[0].options).toMatchObject({
			autoplay: false,
			arrows: false,
			drag: false,
		});
		expect(document.querySelector("[data-testimonials='nav']").hidden).toBe(true);
		expect(document.querySelector(".splide__arrows").hidden).toBe(true);
		expect(document.querySelector(".testimonials_progress").hidden).toBe(true);
	});

	it("destroys both carousel instances and active GSAP motion during cleanup", () => {
		document.body.innerHTML = testimonialMarkup(5);
		const { gsap, tweens } = createGsapDouble();
		const cleanup = initTestimonials(document, SplideDouble, gsap);

		cleanup();

		expect(SplideDouble.instances.every(({ destroyed }) => destroyed)).toBe(true);
		expect(tweens.filter(({ target }) => target.matches?.("[data-testimonials='image']")).every(({ killed }) => killed)).toBe(true);
	});
});
