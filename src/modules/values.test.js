import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initValues } from "./values.js";

function mediaCard(title) {
	return `
		<div class="values_media">
			<img src="/${title.toLowerCase().replaceAll(" ", "-")}.jpg" alt="${title}">
			<div class="values_media-content">
				<div class="values_media-content-inner">
					<div class="values_media-index"></div>
					<div class="values_media-title">${title}</div>
				</div>
			</div>
		</div>
	`;
}

function valueItem(title, isOpen = false) {
	return `
		<div class="value-item${isOpen ? " is-open" : ""}" data-accordion="item">
			<button class="value-item_header" data-accordion="trigger" type="button">${title}</button>
			<div class="value-item_content" data-accordion="content">Body</div>
			${mediaCard(title)}
		</div>
	`;
}

function valuesMarkup({
	titles = ["Integrity", "Human first", "Quality"],
	id = "",
	stagePlaceholder = false,
} = {}) {
	return `
		<section class="values"${id ? ` id="${id}"` : ""}>
			<div class="values_content">
				<div class="values_items" data-accordion="component">
					${titles.map((title, index) => valueItem(title, index === 0)).join("")}
				</div>
				<div class="values_media-stage">${stagePlaceholder ? `${mediaCard("Placeholder").replace('class="values_media"', 'class="values_media is-placeholder"')}` : ""}</div>
			</div>
		</section>
	`;
}

function renderValues(options) {
	document.body.innerHTML = valuesMarkup(options);
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
		listenerCount() {
			return listeners.size;
		},
	};
}

async function flushMutations() {
	await new Promise((resolve) => setTimeout(resolve, 0));
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

function createDeferredGsap() {
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
		to: vi.fn((target) => {
			target.style.opacity = "0.5";
			target.style.visibility = "inherit";
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

	it("updates padded position and total indices for item-owned media", () => {
		renderValues();
		const mediaQuery = createMatchMedia(false);
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => mediaQuery),
		);

		cleanup = initValues(document, createGsap());

		expect(
			[...document.querySelectorAll(".value-item .values_media-index")].map(
				(node) => node.textContent,
			),
		).toEqual(["01 / 03", "02 / 03", "03 / 03"]);
		expect(document.querySelector(".values_media-stage").childElementCount).toBe(0);
	});

	it("keeps authored index nodes during cleanup", () => {
		renderValues();
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => createMatchMedia(false)),
		);
		cleanup = initValues(document, createGsap());

		cleanup();
		cleanup = null;

		expect(document.querySelectorAll(".value-item .values_media-index")).toHaveLength(3);
		expect(
			[...document.querySelectorAll(".value-item .values_media-index")].map(
				(node) => node.textContent,
			),
		).toEqual(["01 / 03", "02 / 03", "03 / 03"]);
		expect(document.querySelectorAll(".values_media")).toHaveLength(3);
	});

	it("builds every desktop clone and initially shows the open item's media", () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
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

	it("removes authored stage placeholders before using the desktop stage", () => {
		renderValues({ stagePlaceholder: true });
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		cleanup = initValues(document, createGsap());

		const stage = document.querySelector(".values_media-stage");
		const clones = [...document.querySelectorAll('[data-values-generated="media"]')];

		expect(stage.querySelector(".values_media.is-placeholder")).toBeNull();
		expect(clones).toHaveLength(3);
		expect(stage.children).toHaveLength(3);
	});

	it("crossfades when another accordion item becomes open", async () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
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
		expect(gsap.to).toHaveBeenCalledWith(
			clones[1],
			expect.objectContaining({
				autoAlpha: 1,
				duration: 0.4,
				ease: "power2.out",
				overwrite: "auto",
			}),
		);
	});

	it("hides stale interrupted clones during rapid item changes", async () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		cleanup = initValues(document, createDeferredGsap());
		const [first, second, third] = document.querySelectorAll(".value-item");

		first.classList.remove("is-open");
		second.classList.add("is-open");
		await flushMutations();
		second.classList.remove("is-open");
		third.classList.add("is-open");
		await flushMutations();

		const clones = [...document.querySelectorAll('[data-values-generated="media"]')];
		expect(clones[0].style.opacity).toBe("0");
		expect(clones[0].style.visibility).toBe("hidden");
		expect(clones[1].style.opacity).toBe("0.5");
		expect(clones[2].style.opacity).toBe("0.5");
		expect(clones.filter((clone) => clone.classList.contains("is-active"))).toEqual([clones[2]]);
	});

	it("keeps the last media selected when its accordion item closes", async () => {
		renderValues();
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => ({ matches: query.includes("min-width") })),
		);
		cleanup = initValues(document, createGsap());
		const first = document.querySelector(".value-item");

		first.classList.remove("is-open");
		await Promise.resolve();

		expect(
			document.querySelector('[data-values-generated="media"].is-active .values_media-title')
				.textContent,
		).toBe("Integrity");
	});

	it("uses immediate crossfades when reduced motion is preferred", async () => {
		renderValues();
		const desktopQuery = createMatchMedia(true);
		const reducedMotionQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? desktopQuery : reducedMotionQuery)),
		);
		const gsap = createGsap();
		cleanup = initValues(document, gsap);
		const [first, second] = document.querySelectorAll(".value-item");

		first.classList.remove("is-open");
		second.classList.add("is-open");
		await Promise.resolve();

		expect(gsap.to).toHaveBeenCalledWith(
			expect.any(Element),
			expect.objectContaining({
				autoAlpha: 0,
				duration: 0,
			}),
		);
		expect(gsap.to).toHaveBeenCalledWith(
			expect.any(Element),
			expect.objectContaining({
				autoAlpha: 1,
				duration: 0,
			}),
		);
	});

	it("keeps the outer selection when a nested Values item opens", async () => {
		renderValues({ titles: ["Outer first", "Outer second"] });
		document.querySelector(".value-item_content").innerHTML = `
			<section class="values">
				<div class="values_content">
					<div class="values_items" data-accordion="component">
						<div class="value-item is-open" data-accordion="item">
							${mediaCard("Nested first")}
						</div>
						<div class="value-item" data-accordion="item">
							${mediaCard("Nested second")}
						</div>
					</div>
					<div class="values_media-stage"></div>
				</div>
			</section>
		`;
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		cleanup = initValues(document, createGsap());
		const outerComponent = document.body.firstElementChild;
		const outerItems = [
			...outerComponent.querySelector(":scope > .values_content > .values_items").children,
		];
		const outerStage = outerComponent.querySelector(
			":scope > .values_content > .values_media-stage",
		);
		const nestedItems = [
			...outerComponent.querySelector(".value-item_content .values_items").children,
		];

		outerItems[0].classList.remove("is-open");
		outerItems[1].classList.add("is-open");
		await Promise.resolve();
		outerItems[1].classList.remove("is-open");
		nestedItems[0].classList.remove("is-open");
		nestedItems[1].classList.add("is-open");
		await Promise.resolve();
		mediaQuery.setMatches(false);
		mediaQuery.setMatches(true);

		expect(outerStage.querySelector(".is-active .values_media-title").textContent).toBe(
			"Outer second",
		);
	});

	it("supports media nested within an item wrapper", () => {
		renderValues();
		const first = document.querySelector(".value-item");
		const content = first.querySelector(".value-item_content");
		const media = first.querySelector(".values_media");
		const wrapper = document.createElement("div");

		wrapper.className = "value-item_media-shell";
		content.append(wrapper);
		wrapper.append(media);

		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => ({ matches: query.includes("min-width") })),
		);
		cleanup = initValues(document, createGsap());

		expect(first.querySelector(".value-item_content .values_media")).toBe(media);
		expect(first.querySelector(".values_media-index")?.textContent).toBe("01 / 03");
		expect(
			document.querySelector('[data-values-generated="media"].is-active .values_media-title')
				.textContent,
		).toBe("Integrity");
	});

	it("builds desktop clones for the currently open mobile item when the query starts matching", async () => {
		renderValues();
		const mediaQuery = createMatchMedia(false);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		cleanup = initValues(document, createGsap());
		const [first, second] = document.querySelectorAll(".value-item");

		first.classList.remove("is-open");
		second.classList.add("is-open");
		await flushMutations();
		mediaQuery.setMatches(true);

		const clones = [...document.querySelectorAll('[data-values-generated="media"]')];
		expect(clones).toHaveLength(3);
		expect(
			document.querySelector('[data-values-generated="media"].is-active .values_media-title')
				.textContent,
		).toBe("Human first");
	});

	it("removes desktop clones without removing original media when the query stops matching", () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		cleanup = initValues(document, createGsap());

		mediaQuery.setMatches(false);

		expect(document.querySelectorAll('[data-values-generated="media"]')).toHaveLength(0);
		expect(document.querySelectorAll(".value-item > .values_media")).toHaveLength(3);
	});

	it("reindexes a newly appended direct item without selecting it", async () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		cleanup = initValues(document, createGsap());
		const items = document.querySelector(".values_items");
		items.insertAdjacentHTML("beforeend", valueItem("Curiosity"));

		await flushMutations();

		expect(
			[...document.querySelectorAll(".value-item .values_media-index")].map(
				(node) => node.textContent,
			),
		).toEqual(["01 / 04", "02 / 04", "03 / 04", "04 / 04"]);
		expect(document.querySelectorAll('[data-values-generated="media"]')).toHaveLength(4);
		expect(
			document.querySelector('[data-values-generated="media"].is-active .values_media-title')
				.textContent,
		).toBe("Integrity");
	});

	it("recalculates positions and totals in DOM order after removal and reordering", async () => {
		renderValues();
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => createMatchMedia(false)),
		);
		cleanup = initValues(document, createGsap());
		const items = document.querySelector(".values_items");
		const [first, second, third] = items.children;

		second.remove();
		items.prepend(third);
		await flushMutations();

		expect(
			[...items.children].map((item) => ({
				title: item.querySelector(".value-item_header").textContent,
				index: item.querySelector(".values_media-index").textContent,
			})),
		).toEqual([
			{ title: "Quality", index: "01 / 02" },
			{ title: "Integrity", index: "02 / 02" },
		]);
		expect(items.contains(first)).toBe(true);
	});

	it("keeps state changes isolated between sibling Values components", async () => {
		document.body.innerHTML = [
			valuesMarkup({ titles: ["First A", "First B"], id: "first-values" }),
			valuesMarkup({ titles: ["Second A", "Second B"], id: "second-values" }),
		].join("");
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		cleanup = initValues(document, createGsap());
		const secondItems = document.querySelectorAll("#second-values .value-item");

		secondItems[0].classList.remove("is-open");
		secondItems[1].classList.add("is-open");
		await flushMutations();

		expect(
			document.querySelector("#first-values .values_media-stage .is-active .values_media-title")
				.textContent,
		).toBe("First A");
		expect(
			document.querySelector("#second-values .values_media-stage .is-active .values_media-title")
				.textContent,
		).toBe("Second B");
	});

	it("returns the same cleanup and observes state once when initialized twice for one root", async () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		const gsap = createGsap();
		const firstCleanup = initValues(document, gsap);
		const secondCleanup = initValues(document, gsap);
		cleanup = firstCleanup;
		const [first, second] = document.querySelectorAll(".value-item");

		first.classList.remove("is-open");
		second.classList.add("is-open");
		await flushMutations();

		expect(secondCleanup).toBe(firstCleanup);
		expect(document.querySelectorAll('[data-values-generated="media"]')).toHaveLength(3);
		expect(gsap.to).toHaveBeenCalledTimes(2);
	});

	it("destroys tweens and generated nodes when a Values component is removed", async () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		const gsap = createGsap();
		cleanup = initValues(document, gsap);
		const component = document.querySelector(".values");
		gsap.killTweensOf.mockClear();

		component.remove();
		await flushMutations();

		expect(gsap.killTweensOf).toHaveBeenCalledTimes(1);
		expect(component.querySelectorAll("[data-values-generated]")).toHaveLength(0);
		expect(mediaQuery.listenerCount()).toBe(0);
	});

	it("fully detaches listeners and observers and ignores later changes after cleanup", async () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		const gsap = createGsap();
		cleanup = initValues(document, gsap);
		const component = document.querySelector(".values");
		const items = component.querySelector(".values_items");

		cleanup();
		cleanup();
		cleanup = null;
		expect(mediaQuery.listenerCount()).toBe(0);
		expect(component.querySelectorAll("[data-values-generated]")).toHaveLength(0);

		items.firstElementChild.classList.remove("is-open");
		items.insertAdjacentHTML("beforeend", valueItem("Ignored"));
		component.insertAdjacentHTML("afterend", valuesMarkup({ titles: ["Also ignored"] }));
		mediaQuery.setMatches(false);
		mediaQuery.setMatches(true);
		await flushMutations();

		expect(document.querySelectorAll("[data-values-generated]")).toHaveLength(0);
		expect(gsap.to).not.toHaveBeenCalled();
	});

	it("warns and returns a no-op cleanup when GSAP is missing", () => {
		renderValues();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		cleanup = initValues(document, undefined);

		expect(warn).toHaveBeenCalledOnce();
		expect(warn).toHaveBeenCalledWith(
			"[values] GSAP was not found. Load GSAP before initializing Values.",
		);
		expect(() => {
			cleanup();
			cleanup();
		}).not.toThrow();
	});

	it("warns once for a missing stage while keeping mobile indices working", async () => {
		renderValues();
		document.querySelector(".values_media-stage").remove();
		const mediaQuery = createMatchMedia(false);
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => mediaQuery),
		);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		cleanup = initValues(document, createGsap());

		document.querySelector(".values_items").insertAdjacentHTML("beforeend", valueItem("Curiosity"));
		await flushMutations();

		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0][0]).toContain(".values_media-stage");
		expect(
			[...document.querySelectorAll(".values_media-index")].map((node) => node.textContent),
		).toEqual(["01 / 04", "02 / 04", "03 / 04", "04 / 04"]);
	});

	it("warns once for a missing .values_media while valid items keep working", async () => {
		renderValues();
		const malformedItem = document.querySelectorAll(".value-item")[1];
		malformedItem.querySelector(".values_media").remove();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		cleanup = initValues(document, createGsap());

		document.querySelector(".values_items").append(document.querySelector(".value-item"));
		await flushMutations();

		expect(warn).toHaveBeenCalledOnce();
		expect(document.querySelectorAll(".value-item .values_media-index")).toHaveLength(2);
		expect(document.querySelectorAll('[data-values-generated="media"]')).toHaveLength(2);
	});

	it("does not initialize a component appended and removed before the root observer flushes", async () => {
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		cleanup = initValues(document, createGsap());
		const template = document.createElement("template");
		template.innerHTML = valuesMarkup();
		const component = template.content.firstElementChild;

		document.body.append(component);
		component.remove();
		await flushMutations();

		expect(component.querySelectorAll("[data-values-generated]")).toHaveLength(0);
		expect(mediaQuery.listenerCount()).toBe(0);
	});
});
