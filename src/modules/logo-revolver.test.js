import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	initLogoRevolver,
	LOGO_REVOLVER_DEFAULTS,
	partitionLogos,
} from "./logo-revolver.js";

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

function createMediaQuery(matches) {
	const listeners = new Set();
	return {
		matches,
		addEventListener(_type, listener) {
			listeners.add(listener);
		},
		removeEventListener(_type, listener) {
			listeners.delete(listener);
		},
		setMatches(next) {
			this.matches = next;
			listeners.forEach((listener) => listener({ matches: next }));
		},
		listenerCount() {
			return listeners.size;
		},
	};
}

function renderLogoComponent(names = ["A", "B", "C", "D", "E", "F"]) {
	document.body.innerHTML = `
		<section data-logo-revolver="root">
			<div data-logo-revolver="desktop">Desktop six-logo fallback</div>
			<div data-logo-revolver="source">
				${names
					.map(
						(name) =>
							`<img data-logo-revolver="logo" src="/${name}.png" srcset="/${name}.png 1x" sizes="50px" alt="${name}" width="100" height="50">`,
					)
					.join("")}
			</div>
		</section>`;
}

function createView({ mobile = true, reduceMotion = false } = {}) {
	const mobileQuery = createMediaQuery(mobile);
	const reducedMotionQuery = createMediaQuery(reduceMotion);
	return {
		mobileQuery,
		reducedMotionQuery,
		view: {
			setTimeout,
			clearTimeout,
			matchMedia: vi.fn((query) =>
				query === LOGO_REVOLVER_DEFAULTS.mobileQuery ? mobileQuery : reducedMotionQuery,
			),
		},
	};
}

describe("initLogoRevolver", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		document.body.innerHTML = "";
	});

	it("leaves desktop markup static and creates no timers", () => {
		renderLogoComponent();
		const { view } = createView({ mobile: false });
		const timeoutSpy = vi.spyOn(view, "setTimeout");

		initLogoRevolver(document, view);

		expect(document.querySelector('[data-logo-revolver="output"]')).toBeNull();
		expect(
			document.querySelector('[data-logo-revolver="root"]').hasAttribute("data-logo-revolver-mounted"),
		).toBe(false);
		expect(timeoutSpy).not.toHaveBeenCalled();
	});

	it("builds two mobile slots and primes round-robin current and next layers", () => {
		renderLogoComponent();
		const { view } = createView();

		initLogoRevolver(document, view);

		const root = document.querySelector('[data-logo-revolver="root"]');
		const slots = [...document.querySelectorAll('[data-logo-revolver="slot"]')];
		expect(root.hasAttribute("data-logo-revolver-mounted")).toBe(true);
		expect(slots).toHaveLength(2);
		expect([...slots[0].querySelectorAll("img")].map((image) => image.alt)).toEqual(["A", "C"]);
		expect([...slots[1].querySelectorAll("img")].map((image) => image.alt)).toEqual(["B", "D"]);
		expect(slots[0].querySelector(".is-current")).toMatchObject({
			srcset: "/A.png 1x",
			sizes: "50px",
			width: 100,
			height: 50,
		});
	});

	it("keeps the desktop fallback when the source is absent or empty", () => {
		document.body.innerHTML = `
			<section data-logo-revolver="root">
				<div data-logo-revolver="desktop">Fallback</div>
			</section>`;
		const { view } = createView();

		initLogoRevolver(document, view);

		expect(document.querySelector('[data-logo-revolver="root"]').hasAttribute("data-logo-revolver-mounted")).toBe(false);
		expect(document.querySelector('[data-logo-revolver="output"]')).toBeNull();
	});

	it("creates one static slot for a single valid logo", () => {
		renderLogoComponent(["A"]);
		const { view } = createView();
		const timeoutSpy = vi.spyOn(view, "setTimeout");

		initLogoRevolver(document, view);

		expect(document.querySelectorAll('[data-logo-revolver="slot"]')).toHaveLength(1);
		expect(document.querySelectorAll('[data-logo-revolver="layer"]')).toHaveLength(1);
		expect(timeoutSpy).not.toHaveBeenCalled();
	});

	it("returns the existing cleanup when initialized twice", () => {
		renderLogoComponent();
		const { view } = createView();
		const cleanup = initLogoRevolver(document, view);

		expect(initLogoRevolver(document, view)).toBe(cleanup);
		expect(document.querySelectorAll('[data-logo-revolver="output"]')).toHaveLength(1);
	});

	it("revolves each slot on a 400ms stagger and recycles its two layers", async () => {
		renderLogoComponent();
		const { view } = createView();
		initLogoRevolver(document, view);
		const [first, second] = document.querySelectorAll('[data-logo-revolver="slot"]');

		await vi.advanceTimersByTimeAsync(5500);
		expect(first.querySelector(".is-current").alt).toBe("C");
		expect(first.querySelector(".is-leaving").alt).toBe("A");
		expect(second.querySelector(".is-current").alt).toBe("B");

		await vi.advanceTimersByTimeAsync(400);
		expect(second.querySelector(".is-current").alt).toBe("D");

		await vi.advanceTimersByTimeAsync(650);
		expect(first.querySelector(".is-leaving")).toBeNull();
		expect([...first.querySelectorAll("img")].map((image) => image.alt).sort()).toEqual(["C", "E"]);
	});

	it("shows the first two logos without timers for reduced motion", () => {
		renderLogoComponent();
		const { view } = createView({ reduceMotion: true });
		const timeoutSpy = vi.spyOn(view, "setTimeout");

		initLogoRevolver(document, view);

		expect([...document.querySelectorAll('[data-logo-revolver="slot"] .is-current')].map((image) => image.alt)).toEqual(["A", "B"]);
		expect(timeoutSpy).not.toHaveBeenCalled();
	});

	it("removes the generated grid and timers when the viewport becomes desktop", async () => {
		renderLogoComponent();
		const { view, mobileQuery } = createView();
		initLogoRevolver(document, view);

		mobileQuery.setMatches(false);
		await vi.advanceTimersByTimeAsync(100);

		expect(document.querySelector('[data-logo-revolver="output"]')).toBeNull();
		expect(document.querySelector('[data-logo-revolver="root"]').hasAttribute("data-logo-revolver-mounted")).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("rebuilds when reduced-motion changes and fully cleans up listeners and markup", async () => {
		renderLogoComponent();
		const { view, mobileQuery, reducedMotionQuery } = createView();
		const cleanup = initLogoRevolver(document, view);

		reducedMotionQuery.setMatches(true);
		await vi.advanceTimersByTimeAsync(100);
		expect(vi.getTimerCount()).toBe(0);
		expect(document.querySelectorAll('[data-logo-revolver="slot"]')).toHaveLength(2);

		cleanup();
		expect(document.querySelector('[data-logo-revolver="output"]')).toBeNull();
		expect(mobileQuery.listenerCount()).toBe(0);
		expect(reducedMotionQuery.listenerCount()).toBe(0);
	});
});
