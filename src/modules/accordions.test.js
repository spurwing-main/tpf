import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initAccordions } from "./accordions.js";

function createGsap({ completeImmediately = true } = {}) {
	const tweens = [];
	const killedTargets = [];

	function apply(target, vars) {
		if (vars.clearProps) {
			for (const property of vars.clearProps.split(",")) {
				target.style.removeProperty(property.trim());
			}
		}
		if ("height" in vars) {
			target.style.height = typeof vars.height === "number" ? `${vars.height}px` : vars.height;
		}
		if ("overflow" in vars) target.style.overflow = vars.overflow;
	}

	const gsap = {
		killedTargets,
		tweens,
		set(target, vars) {
			apply(target, vars);
		},
		to(target, vars) {
			const tween = {
				killed: false,
				target,
				vars,
				kill() {
					this.killed = true;
				},
				complete() {
					if (!this.killed) vars.onComplete?.();
				},
			};

			apply(target, vars);
			tweens.push(tween);
			if (completeImmediately) tween.complete();
			return tween;
		},
		killTweensOf(target) {
			killedTargets.push(target);
			tweens.filter((tween) => tween.target === target).forEach((tween) => tween.kill());
		},
	};

	return gsap;
}

function accordionMarkup({ options = "", prefix = "one", items = 2 } = {}) {
	return `
		<section data-accordion="component" ${options}>
			${Array.from(
				{ length: items },
				(_, index) => `
					<div data-accordion="item">
						<button data-accordion="trigger">${prefix} ${index + 1}</button>
						<div data-accordion="content">Content ${index + 1}</div>
					</div>
				`,
			).join("")}
		</section>
	`;
}

function getItems(root = document) {
	return [...root.querySelectorAll('[data-accordion="item"]')];
}

async function flushMutations() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("initAccordions", () => {
	let cleanup;

	beforeEach(() => {
		document.body.innerHTML = "";
		cleanup = null;
		vi.restoreAllMocks();
	});

	afterEach(() => cleanup?.());
	afterEach(() => vi.unstubAllGlobals());

	it("initializes items closed with the required accessible state and generated relationships", () => {
		document.body.innerHTML = accordionMarkup();
		cleanup = initAccordions(document, createGsap());

		for (const item of getItems()) {
			const trigger = item.querySelector("button");
			const content = item.querySelector('[data-accordion="content"]');

			expect(item.classList.contains("is-open")).toBe(false);
			expect(trigger.getAttribute("aria-expanded")).toBe("false");
			expect(content.getAttribute("aria-hidden")).toBe("true");
			expect(content.hasAttribute("inert")).toBe(true);
			expect(content.id).toMatch(/^accordion-content-/);
			expect(trigger.getAttribute("aria-controls")).toBe(content.id);
			expect(content.style.height).toBe("0px");
			expect(content.style.overflow).toBe("hidden");
		}
	});

	it("opens only the first item initially when configured, and lets an open item close", () => {
		document.body.innerHTML = accordionMarkup({
			options: 'data-accordion-first-open="true"',
		});
		cleanup = initAccordions(document, createGsap());
		const [first, second] = getItems();

		expect(first.classList.contains("is-open")).toBe(true);
		expect(first.querySelector("button").getAttribute("aria-expanded")).toBe("true");
		expect(first.querySelector('[data-accordion="content"]').hasAttribute("inert")).toBe(false);
		expect(second.classList.contains("is-open")).toBe(false);

		first.querySelector("button").click();

		expect(first.classList.contains("is-open")).toBe(false);
		expect(first.querySelector('[data-accordion="content"]').hasAttribute("inert")).toBe(true);
	});

	it("closes the previously open item by default", () => {
		document.body.innerHTML = accordionMarkup();
		cleanup = initAccordions(document, createGsap());
		const [first, second] = getItems();

		first.querySelector("button").click();
		second.querySelector("button").click();

		expect(first.classList.contains("is-open")).toBe(false);
		expect(second.classList.contains("is-open")).toBe(true);
	});

	it("allows multiple open items when close-others is false", () => {
		document.body.innerHTML = accordionMarkup({
			options: 'data-accordion-close-others="false"',
		});
		cleanup = initAccordions(document, createGsap());
		const [first, second] = getItems();

		first.querySelector("button").click();
		second.querySelector("button").click();

		expect(first.classList.contains("is-open")).toBe(true);
		expect(second.classList.contains("is-open")).toBe(true);
	});

	it("keeps nested accordion items scoped to their nearest component", () => {
		document.body.innerHTML = `
			<section data-accordion="component">
				<div data-accordion="item">
					<button data-accordion="trigger">Outer</button>
					<div data-accordion="content">
						${accordionMarkup({ prefix: "inner" })}
					</div>
				</div>
			</section>
		`;
		cleanup = initAccordions(document, createGsap());
		const outerItem = document.querySelector('[data-accordion="component"] > [data-accordion="item"]');
		const innerItems = getItems(document.querySelectorAll('[data-accordion="component"]')[1]);

		outerItem.querySelector(':scope > [data-accordion="trigger"]').click();
		innerItems[0].querySelector("button").click();
		innerItems[1].querySelector("button").click();

		expect(outerItem.classList.contains("is-open")).toBe(true);
		expect(innerItems[0].classList.contains("is-open")).toBe(false);
		expect(innerItems[1].classList.contains("is-open")).toBe(true);
	});

	it("initializes later items closed without reapplying first-open", async () => {
		document.body.innerHTML = accordionMarkup({
			options: 'data-accordion-first-open="true"',
			items: 1,
		});
		cleanup = initAccordions(document, createGsap());
		const component = document.querySelector('[data-accordion="component"]');
		component.insertAdjacentHTML(
			"beforeend",
			`<div data-accordion="item">
				<button data-accordion="trigger">Later</button>
				<div data-accordion="content">Later content</div>
			</div>`,
		);
		await flushMutations();
		const [first, later] = getItems();

		expect(first.classList.contains("is-open")).toBe(true);
		expect(later.classList.contains("is-open")).toBe(false);
		expect(later.querySelector("button").getAttribute("aria-expanded")).toBe("false");

		later.querySelector("button").click();
		expect(first.classList.contains("is-open")).toBe(false);
		expect(later.classList.contains("is-open")).toBe(true);
	});

	it("applies first-open during the initial setup of a newly inserted component", async () => {
		cleanup = initAccordions(document, createGsap());
		document.body.insertAdjacentHTML(
			"beforeend",
			accordionMarkup({ options: 'data-accordion-first-open="true"', prefix: "later" }),
		);
		await flushMutations();

		expect(getItems()[0].classList.contains("is-open")).toBe(true);
		expect(getItems()[1].classList.contains("is-open")).toBe(false);
	});

	it("does not initialize a component removed before its insertion is observed", async () => {
		const gsap = createGsap();
		cleanup = initAccordions(document, gsap);
		const host = document.createElement("div");
		host.innerHTML = accordionMarkup({ items: 1 });
		const component = host.firstElementChild;
		const trigger = component.querySelector("button");
		const content = component.querySelector('[data-accordion="content"]');

		document.body.append(component);
		component.remove();
		await flushMutations();

		expect(trigger.hasAttribute("aria-expanded")).toBe(false);
		expect(content.hasAttribute("aria-hidden")).toBe(false);
		expect(content.hasAttribute("inert")).toBe(false);
		expect(content.style.height).toBe("");
		expect(gsap.killedTargets).toHaveLength(0);
	});

	it("kills interrupted tweens and ignores stale completion callbacks during rapid toggles", () => {
		document.body.innerHTML = accordionMarkup({ items: 1 });
		const gsap = createGsap({ completeImmediately: false });
		cleanup = initAccordions(document, gsap);
		const item = getItems()[0];
		const trigger = item.querySelector("button");
		const content = item.querySelector('[data-accordion="content"]');

		trigger.click();
		const openingTween = gsap.tweens.at(-1);
		trigger.click();
		openingTween.complete();

		expect(openingTween.killed).toBe(true);
		expect(gsap.killedTargets.filter((target) => target === content).length).toBeGreaterThanOrEqual(2);
		expect(item.classList.contains("is-open")).toBe(false);
		expect(content.style.height).toBe("0px");
		expect(content.style.overflow).toBe("hidden");
	});

	it("clears fixed animation dimensions after opening so content can resize naturally", () => {
		document.body.innerHTML = accordionMarkup({ items: 1 });
		cleanup = initAccordions(document, createGsap());
		const item = getItems()[0];
		const content = item.querySelector('[data-accordion="content"]');

		item.querySelector("button").click();

		expect(content.style.height).toBe("");
		expect(content.style.overflow).toBe("");
		expect(content.getAttribute("aria-hidden")).toBe("false");
	});

	it("uses zero-duration transitions when reduced motion is preferred", () => {
		document.body.innerHTML = accordionMarkup({ items: 1 });
		vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
		const gsap = createGsap();
		cleanup = initAccordions(document, gsap);

		getItems()[0].querySelector("button").click();

		expect(gsap.tweens.at(-1).vars.duration).toBe(0);
	});

	it("warns once and skips malformed items", () => {
		document.body.innerHTML = `
			<section data-accordion="component">
				<div data-accordion="item"><div data-accordion="content"></div></div>
				<div data-accordion="item"><div data-accordion="trigger"></div><div data-accordion="content"></div></div>
			</section>
		`;
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		cleanup = initAccordions(document, createGsap());

		expect(warn).toHaveBeenCalledTimes(2);
		expect(getItems().every((item) => !item.classList.contains("is-open"))).toBe(true);
	});

	it("warns and becomes a no-op when GSAP is missing", () => {
		document.body.innerHTML = accordionMarkup();
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		cleanup = initAccordions(document, undefined);
		getItems()[0].querySelector("button").click();

		expect(warn).toHaveBeenCalledWith(
			"[accordions] GSAP was not found. Load GSAP before initializing accordions.",
		);
		expect(getItems().some((item) => item.classList.contains("is-open"))).toBe(false);
	});

	it("cleans up removed items and disconnects all behavior on module cleanup", async () => {
		document.body.innerHTML = accordionMarkup({ items: 1 });
		const gsap = createGsap();
		cleanup = initAccordions(document, gsap);
		const item = getItems()[0];
		const trigger = item.querySelector("button");
		const content = item.querySelector('[data-accordion="content"]');

		item.remove();
		await flushMutations();
		expect(gsap.killedTargets).toContain(content);

		document.body.append(item);
		await flushMutations();
		cleanup();
		cleanup = null;
		trigger.click();

		expect(item.classList.contains("is-open")).toBe(false);
	});
});
