import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initValues } from "./values.js";

function mediaCard(title) {
	return `
		<div class="values_media">
			<img src="/${title.toLowerCase().replaceAll(" ", "-")}.jpg" alt="${title}">
			<div class="values_media-content">
				<div class="values_media-content-inner">
					<div class="values_media-title">${title}</div>
				</div>
			</div>
		</div>
	`;
}

function renderValues({ titles = ["Integrity", "Human first", "Quality"] } = {}) {
	document.body.innerHTML = `
		<section class="values">
			<div class="values_content">
				<div class="values_items" data-accordion="component">
					${titles.map((title, index) => `
						<div class="value-item${index === 0 ? " is-open" : ""}" data-accordion="item">
							<button class="value-item_header" data-accordion="trigger" type="button">${title}</button>
							<div class="value-item_content" data-accordion="content">Body</div>
							${mediaCard(title)}
						</div>
					`).join("")}
				</div>
				<div class="values_media-stage"></div>
			</div>
		</section>
	`;
}

function createMatchMedia(matches = false) {
	const listeners = new Set();
	return {
		matches,
		addEventListener: (_type, listener) => listeners.add(listener),
		removeEventListener: (_type, listener) => listeners.delete(listener),
		setMatches(nextMatches) {
			this.matches = nextMatches;
			listeners.forEach((listener) => listener({ matches: nextMatches }));
		},
	};
}

function createGsap() {
	const applyAutoAlpha = (targets, variables) => {
		if (variables.autoAlpha === undefined) return;
		const elements = Array.isArray(targets) ? targets : [targets];
		elements.forEach((element) => {
			element.style.opacity = String(variables.autoAlpha);
			element.style.visibility = variables.autoAlpha === 0 ? "hidden" : "inherit";
		});
	};

	return {
		set: vi.fn((targets, variables) => applyAutoAlpha(targets, variables)),
		to: vi.fn((targets, variables) => {
			applyAutoAlpha(targets, variables);
			return { kill: vi.fn() };
		}),
		killTweensOf: vi.fn(),
	};
}

describe("initValues", () => {
	let cleanup;

	beforeEach(() => {
		document.body.innerHTML = "";
		cleanup = null;
		vi.restoreAllMocks();
	});

	afterEach(() => cleanup?.());

	it("generates padded position and total indices for item-owned media", () => {
		renderValues();
		const mediaQuery = createMatchMedia(false);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

		cleanup = initValues(document, createGsap());

		expect([...document.querySelectorAll(".value-item .values_media-index")].map((node) => node.textContent)).toEqual([
			"01 / 03",
			"02 / 03",
			"03 / 03",
		]);
		expect(document.querySelector(".values_media-stage").childElementCount).toBe(0);
	});

	it("removes only module-generated index nodes during cleanup", () => {
		renderValues();
		vi.stubGlobal("matchMedia", vi.fn(() => createMatchMedia(false)));
		cleanup = initValues(document, createGsap());

		cleanup();
		cleanup = null;

		expect(document.querySelectorAll('[data-values-generated="index"]')).toHaveLength(0);
		expect(document.querySelectorAll(".values_media")).toHaveLength(3);
	});

	it("builds every desktop clone and initially shows the open item's media", () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal("matchMedia", vi.fn((query) =>
			query === "(min-width: 768px)" ? mediaQuery : { matches: false },
		));
		cleanup = initValues(document, createGsap());

		const clones = [...document.querySelectorAll('[data-values-generated="media"]')];
		expect(clones).toHaveLength(3);
		expect(clones.map((clone) => clone.querySelector(".values_media-title").textContent)).toEqual([
			"Integrity",
			"Human first",
			"Quality",
		]);
		expect(clones[0].classList.contains("is-active")).toBe(true);
		expect(clones[0].getAttribute("aria-hidden")).toBe("false");
		expect(clones[1].hasAttribute("inert")).toBe(true);
	});

	it("crossfades when another accordion item becomes open", async () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal("matchMedia", vi.fn((query) =>
			query === "(min-width: 768px)" ? mediaQuery : { matches: false },
		));
		const gsap = createGsap();
		cleanup = initValues(document, gsap);
		const [first, second] = document.querySelectorAll(".value-item");

		first.classList.remove("is-open");
		second.classList.add("is-open");
		await Promise.resolve();

		const clones = [...document.querySelectorAll('[data-values-generated="media"]')];
		expect(clones[0].classList.contains("is-active")).toBe(false);
		expect(clones[1].classList.contains("is-active")).toBe(true);
		expect(gsap.killTweensOf).toHaveBeenCalled();
		expect(gsap.to).toHaveBeenCalledWith(clones[1], expect.objectContaining({
			autoAlpha: 1,
			duration: 0.4,
			ease: "power2.out",
			overwrite: "auto",
		}));
	});

	it("keeps the last media selected when its accordion item closes", async () => {
		renderValues();
		vi.stubGlobal("matchMedia", vi.fn((query) => ({ matches: query.includes("min-width") })));
		cleanup = initValues(document, createGsap());
		const first = document.querySelector(".value-item");

		first.classList.remove("is-open");
		await Promise.resolve();

		expect(document.querySelector('[data-values-generated="media"].is-active .values_media-title').textContent).toBe("Integrity");
	});

	it("uses immediate crossfades when reduced motion is preferred", async () => {
		renderValues();
		const desktopQuery = createMatchMedia(true);
		const reducedMotionQuery = createMatchMedia(true);
		vi.stubGlobal("matchMedia", vi.fn((query) =>
			query === "(min-width: 768px)" ? desktopQuery : reducedMotionQuery,
		));
		const gsap = createGsap();
		cleanup = initValues(document, gsap);
		const [first, second] = document.querySelectorAll(".value-item");

		first.classList.remove("is-open");
		second.classList.add("is-open");
		await Promise.resolve();

		expect(gsap.to).toHaveBeenCalledWith(expect.any(Element), expect.objectContaining({
			autoAlpha: 0,
			duration: 0,
		}));
		expect(gsap.to).toHaveBeenCalledWith(expect.any(Element), expect.objectContaining({
			autoAlpha: 1,
			duration: 0,
		}));
	});
});
