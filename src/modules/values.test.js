import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initPanelStack } from "./panel-stack.js";

function mediaCard(title) {
	return `
		<div class="values_media" data-panel-stack-source>
			<img src="/${title.toLowerCase().replaceAll(" ", "-")}.jpg" alt="${title}">
			<div class="values_media-content">
				<div class="values_media-content-inner">
					<div class="values_media-index" data-panel-stack-index></div>
					<div class="values_media-title">${title}</div>
				</div>
			</div>
		</div>
	`;
}

function valueItem(title, isOpen = false) {
	return `
		<div class="value-item${isOpen ? " is-open" : ""}" data-accordion="item" data-panel-stack-item>
			<button class="value-item_header" data-accordion="trigger" type="button">${title}</button>
			<div class="value-item_content" data-accordion="content">Body${mediaCard(title)}</div>
		</div>
	`;
}

function valuesMarkup({
	titles = ["Integrity", "Human first", "Quality"],
	id = "",
	stagePlaceholder = false,
} = {}) {
	return `
	<section class="values" data-panel-stack${id ? ` id="${id}"` : ""}>
			<div class="values_content">
				<div class="values_items" data-accordion="component" data-panel-stack-list>
					${titles.map((title, index) => valueItem(title, index === 0)).join("")}
				</div>
				<div class="values_media-stage" data-panel-stack-stage>${stagePlaceholder ? `${mediaCard("Placeholder").replace('class="values_media" data-panel-stack-source', 'class="values_media is-placeholder" data-panel-stack-placeholder')}` : ""}</div>
			</div>
		</section>
	`;
}

function renderValues(options) {
	document.body.innerHTML = valuesMarkup(options);
}

function servicesMarkup({ titles = ["Strategy", "Coaching", "Events"] } = {}) {
	return `
		<section class="services" data-panel-stack>
			<div class="services_items" data-panel-stack-list>
				${titles
					.map(
						(title, index) => `
							<div class="service-item${index === 0 ? " is-open" : ""}" data-panel-stack-item>
								<div class="service-item_header">${title}</div>
								<div class="service-item_content">
									<div class="services_media" data-panel-stack-source>
										<div class="services_media-title">${title}</div>
									</div>
								</div>
							</div>`,
					)
					.join("")}
			</div>
			<div class="services_media-stage" data-panel-stack-stage></div>
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

describe("initPanelStack", () => {
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

		cleanup = initPanelStack(document, createGsap());

		expect(
			[...document.querySelectorAll(".value-item [data-panel-stack-index]")].map(
				(node) => node.textContent,
			),
		).toEqual(["01 / 03", "02 / 03", "03 / 03"]);
		expect(document.querySelector("[data-panel-stack-stage]").childElementCount).toBe(0);
	});

	it("emits the current mobile render surface and active source", () => {
		renderValues();
		const mediaQuery = createMatchMedia(false);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));
		const stateChanges = [];
		document.addEventListener("panel-stack:statechange", (event) => stateChanges.push(event));

		cleanup = initPanelStack(document, createGsap());

		const component = document.querySelector("[data-panel-stack]");
		const sources = [...component.querySelectorAll("[data-panel-stack-source]")];
		expect(stateChanges).toHaveLength(1);
		expect(stateChanges[0].target).toBe(component);
		expect(stateChanges[0].detail).toEqual({
			mode: "mobile",
			sources,
			activeSource: sources[0],
			previousSource: null,
		});
	});

	it("emits generated desktop sources and the previous source when an item changes", async () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		const stateChanges = [];
		document.addEventListener("panel-stack:statechange", (event) => stateChanges.push(event));

		cleanup = initPanelStack(document, createGsap());
		const [first, second] = document.querySelectorAll(".value-item");
		const clones = [...document.querySelectorAll('[data-panel-stack-generated="source"]')];

		first.classList.remove("is-open");
		second.classList.add("is-open");
		await flushMutations();

		expect(stateChanges).toHaveLength(2);
		expect(stateChanges[0].detail).toEqual({
			mode: "desktop",
			sources: clones,
			activeSource: clones[0],
			previousSource: null,
		});
		expect(stateChanges[1].detail).toEqual({
			mode: "desktop",
			sources: clones,
			activeSource: clones[1],
			previousSource: clones[0],
		});
	});

	it("emits the authored sources after returning from desktop to mobile", () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		const stateChanges = [];
		document.addEventListener("panel-stack:statechange", (event) => stateChanges.push(event));

		cleanup = initPanelStack(document, createGsap());
		const desktopSources = stateChanges[0].detail.sources;
		mediaQuery.setMatches(false);

		const mobileSources = [...document.querySelectorAll(".value-item [data-panel-stack-source]")];
		expect(stateChanges).toHaveLength(2);
		expect(stateChanges[1].detail).toEqual({
			mode: "mobile",
			sources: mobileSources,
			activeSource: mobileSources[0],
			previousSource: desktopSources[0],
		});
	});

	it("emits a rebuilt mobile surface when items are added or reordered", async () => {
		renderValues();
		const mediaQuery = createMatchMedia(false);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));
		const stateChanges = [];
		document.addEventListener("panel-stack:statechange", (event) => stateChanges.push(event));
		cleanup = initPanelStack(document, createGsap());

		const items = document.querySelector("[data-panel-stack-list]");
		items.insertAdjacentHTML("beforeend", valueItem("Curiosity"));
		await flushMutations();
		const [first, second, third, fourth] = items.children;
		items.prepend(fourth);
		await flushMutations();

		expect(stateChanges).toHaveLength(3);
		expect(stateChanges.at(-1).detail.sources).toEqual([
			fourth.querySelector("[data-panel-stack-source]"),
			first.querySelector("[data-panel-stack-source]"),
			second.querySelector("[data-panel-stack-source]"),
			third.querySelector("[data-panel-stack-source]"),
		]);
		expect(stateChanges.at(-1).detail.activeSource).toBe(
			first.querySelector("[data-panel-stack-source]"),
		);
	});

	it("emits the authored surface when desktop stacking has no stage", () => {
		renderValues();
		document.querySelector("[data-panel-stack-stage]").remove();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));
		const stateChanges = [];
		document.addEventListener("panel-stack:statechange", (event) => stateChanges.push(event));
		cleanup = initPanelStack(document, createGsap());

		const sources = [...document.querySelectorAll("[data-panel-stack-source]")];
		expect(stateChanges).toHaveLength(1);
		expect(stateChanges[0].detail).toEqual({
			mode: "mobile",
			sources,
			activeSource: sources[0],
			previousSource: null,
		});
	});

	it("supports a Services-shaped component without Values-specific classes or indices", () => {
		document.body.innerHTML = servicesMarkup();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);

		cleanup = initPanelStack(document, createGsap());

		const clones = [...document.querySelectorAll('[data-panel-stack-generated="source"]')];
		expect(clones).toHaveLength(3);
		expect(clones.map((clone) => clone.querySelector(".services_media-title").textContent)).toEqual([
			"Strategy",
			"Coaching",
			"Events",
		]);
		expect(clones[0].classList.contains("is-active")).toBe(true);
		expect(document.querySelectorAll("[data-panel-stack-index]")).toHaveLength(0);
	});

	it("keeps authored index nodes during cleanup", () => {
		renderValues();
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => createMatchMedia(false)),
		);
		cleanup = initPanelStack(document, createGsap());

		cleanup();
		cleanup = null;

		expect(document.querySelectorAll(".value-item [data-panel-stack-index]")).toHaveLength(3);
		expect(
			[...document.querySelectorAll(".value-item [data-panel-stack-index]")].map(
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
		cleanup = initPanelStack(document, createGsap());

		const clones = [...document.querySelectorAll('[data-panel-stack-generated="source"]')];
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
		cleanup = initPanelStack(document, createGsap());

		const stage = document.querySelector("[data-panel-stack-stage]");
		const clones = [...document.querySelectorAll('[data-panel-stack-generated="source"]')];

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
		cleanup = initPanelStack(document, gsap);
		const [first, second] = document.querySelectorAll(".value-item");

		first.classList.remove("is-open");
		second.classList.add("is-open");
		await Promise.resolve();

		const clones = [...document.querySelectorAll('[data-panel-stack-generated="source"]')];
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
		cleanup = initPanelStack(document, createDeferredGsap());
		const [first, second, third] = document.querySelectorAll(".value-item");

		first.classList.remove("is-open");
		second.classList.add("is-open");
		await flushMutations();
		second.classList.remove("is-open");
		third.classList.add("is-open");
		await flushMutations();

		const clones = [...document.querySelectorAll('[data-panel-stack-generated="source"]')];
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
		cleanup = initPanelStack(document, createGsap());
		const first = document.querySelector(".value-item");

		first.classList.remove("is-open");
		await Promise.resolve();

		expect(
			document.querySelector('[data-panel-stack-generated="source"].is-active .values_media-title')
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
		cleanup = initPanelStack(document, gsap);
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
			<section class="values" data-panel-stack>
				<div class="values_content">
					<div class="values_items" data-accordion="component" data-panel-stack-list>
						<div class="value-item is-open" data-accordion="item" data-panel-stack-item>
							${mediaCard("Nested first")}
						</div>
						<div class="value-item" data-accordion="item" data-panel-stack-item>
							${mediaCard("Nested second")}
						</div>
					</div>
					<div class="values_media-stage" data-panel-stack-stage></div>
				</div>
			</section>
		`;
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		cleanup = initPanelStack(document, createGsap());
		const outerComponent = document.body.firstElementChild;
		const outerItems = [
			...outerComponent.querySelector(":scope > .values_content > .values_items").children,
		];
		const outerStage = outerComponent.querySelector(
			":scope > .values_content > [data-panel-stack-stage]",
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
		cleanup = initPanelStack(document, createGsap());

		expect(first.querySelector(".value-item_content .values_media")).toBe(media);
		expect(first.querySelector("[data-panel-stack-index]")?.textContent).toBe("01 / 03");
		expect(
			document.querySelector('[data-panel-stack-generated="source"].is-active .values_media-title')
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
		cleanup = initPanelStack(document, createGsap());
		const [first, second] = document.querySelectorAll(".value-item");

		first.classList.remove("is-open");
		second.classList.add("is-open");
		await flushMutations();
		mediaQuery.setMatches(true);

		const clones = [...document.querySelectorAll('[data-panel-stack-generated="source"]')];
		expect(clones).toHaveLength(3);
		expect(
			document.querySelector('[data-panel-stack-generated="source"].is-active .values_media-title')
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
		cleanup = initPanelStack(document, createGsap());

		mediaQuery.setMatches(false);

		expect(document.querySelectorAll('[data-panel-stack-generated="source"]')).toHaveLength(0);
		expect(document.querySelectorAll(".value-item [data-panel-stack-source]")).toHaveLength(3);
	});

	it("reindexes a newly appended direct item without selecting it", async () => {
		renderValues();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		cleanup = initPanelStack(document, createGsap());
		const items = document.querySelector(".values_items");
		items.insertAdjacentHTML("beforeend", valueItem("Curiosity"));

		await flushMutations();

		expect(
			[...document.querySelectorAll(".value-item [data-panel-stack-index]")].map(
				(node) => node.textContent,
			),
		).toEqual(["01 / 04", "02 / 04", "03 / 04", "04 / 04"]);
		expect(document.querySelectorAll('[data-panel-stack-generated="source"]')).toHaveLength(4);
		expect(
			document.querySelector('[data-panel-stack-generated="source"].is-active .values_media-title')
				.textContent,
		).toBe("Integrity");
	});

	it("recalculates positions and totals in DOM order after removal and reordering", async () => {
		renderValues();
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => createMatchMedia(false)),
		);
		cleanup = initPanelStack(document, createGsap());
		const items = document.querySelector(".values_items");
		const [first, second, third] = items.children;

		second.remove();
		items.prepend(third);
		await flushMutations();

		expect(
			[...items.children].map((item) => ({
				title: item.querySelector(".value-item_header").textContent,
				index: item.querySelector("[data-panel-stack-index]").textContent,
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
		cleanup = initPanelStack(document, createGsap());
		const secondItems = document.querySelectorAll("#second-values .value-item");

		secondItems[0].classList.remove("is-open");
		secondItems[1].classList.add("is-open");
		await flushMutations();

		expect(
			document.querySelector("#first-values [data-panel-stack-stage] .is-active .values_media-title")
				.textContent,
		).toBe("First A");
		expect(
			document.querySelector("#second-values [data-panel-stack-stage] .is-active .values_media-title")
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
		const firstCleanup = initPanelStack(document, gsap);
		const secondCleanup = initPanelStack(document, gsap);
		cleanup = firstCleanup;
		const [first, second] = document.querySelectorAll(".value-item");

		first.classList.remove("is-open");
		second.classList.add("is-open");
		await flushMutations();

		expect(secondCleanup).toBe(firstCleanup);
		expect(document.querySelectorAll('[data-panel-stack-generated="source"]')).toHaveLength(3);
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
		cleanup = initPanelStack(document, gsap);
		const component = document.querySelector(".values");
		gsap.killTweensOf.mockClear();

		component.remove();
		await flushMutations();

		expect(gsap.killTweensOf).toHaveBeenCalledTimes(1);
		expect(component.querySelectorAll("[data-panel-stack-generated]")).toHaveLength(0);
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
		cleanup = initPanelStack(document, gsap);
		const component = document.querySelector(".values");
		const items = component.querySelector(".values_items");

		cleanup();
		cleanup();
		cleanup = null;
		expect(mediaQuery.listenerCount()).toBe(0);
		expect(component.querySelectorAll("[data-panel-stack-generated]")).toHaveLength(0);

		items.firstElementChild.classList.remove("is-open");
		items.insertAdjacentHTML("beforeend", valueItem("Ignored"));
		component.insertAdjacentHTML("afterend", valuesMarkup({ titles: ["Also ignored"] }));
		mediaQuery.setMatches(false);
		mediaQuery.setMatches(true);
		await flushMutations();

		expect(document.querySelectorAll("[data-panel-stack-generated]")).toHaveLength(0);
		expect(gsap.to).not.toHaveBeenCalled();
	});

	it("warns and returns a no-op cleanup when GSAP is missing", () => {
		renderValues();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		cleanup = initPanelStack(document, undefined);

		expect(warn).toHaveBeenCalledOnce();
		expect(warn).toHaveBeenCalledWith(
			"[panel-stack] GSAP was not found. Load GSAP before initializing panel stacks.",
		);
		expect(() => {
			cleanup();
			cleanup();
		}).not.toThrow();
	});

	it("warns once for a missing stage while keeping mobile indices working", async () => {
		renderValues();
		document.querySelector("[data-panel-stack-stage]").remove();
		const mediaQuery = createMatchMedia(false);
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => mediaQuery),
		);
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		cleanup = initPanelStack(document, createGsap());

		document.querySelector(".values_items").insertAdjacentHTML("beforeend", valueItem("Curiosity"));
		await flushMutations();

		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0][0]).toContain("data-panel-stack-stage");
		expect(
			[...document.querySelectorAll("[data-panel-stack-index]")].map((node) => node.textContent),
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
		cleanup = initPanelStack(document, createGsap());

		document.querySelector(".values_items").append(document.querySelector(".value-item"));
		await flushMutations();

		expect(warn).toHaveBeenCalledOnce();
		expect(document.querySelectorAll(".value-item [data-panel-stack-index]")).toHaveLength(2);
		expect(document.querySelectorAll('[data-panel-stack-generated="source"]')).toHaveLength(2);
	});

	it("does not initialize a component appended and removed before the root observer flushes", async () => {
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		cleanup = initPanelStack(document, createGsap());
		const template = document.createElement("template");
		template.innerHTML = valuesMarkup();
		const component = template.content.firstElementChild;

		document.body.append(component);
		component.remove();
		await flushMutations();

		expect(component.querySelectorAll("[data-panel-stack-generated]")).toHaveLength(0);
		expect(mediaQuery.listenerCount()).toBe(0);
	});
});
