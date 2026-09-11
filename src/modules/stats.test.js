import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initStats } from "./stats.js";

function createGsap() {
	const timelines = [];
	const gsap = {
		registerPlugin: vi.fn(),
		timeline: vi.fn((config) => {
			const timeline = {
				config,
				entries: [],
				scrollTrigger: { kill: vi.fn() },
				kill: vi.fn(),
				from(target, variables, position) {
					this.entries.push({ target, variables, position });
					target.textContent = String(variables.textContent);
					return this;
				},
			};
			timelines.push(timeline);
			return timeline;
		}),
	};

	return { gsap, timelines };
}

function renderStats() {
	document.body.innerHTML = `
		<section data-stats="component">
			<div class="stat"><span>£</span><span data-stats="value" data-start="108" data-increment="1">111</span><span>m+</span></div>
		</section>
	`;
}

function renderValues(values) {
	document.body.innerHTML = `
		<section data-stats="component">
			${values
				.map(
					({ start, increment, end }) =>
						`<div class="stat"><span data-stats="value" data-start="${start}" data-increment="${increment}">${end}</span></div>`,
				)
				.join("")}
		</section>
	`;
}

describe("initStats", () => {
	let cleanup;
	let rectSpy;

	beforeEach(() => {
		document.body.innerHTML = "";
		cleanup = null;
		vi.restoreAllMocks();
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({ matches: false })),
		);
		const widths = new Map([
			["108", 30],
			["109", 36],
			["110", 25],
			["111", 24],
		]);
		rectSpy = vi
			.spyOn(HTMLElement.prototype, "getBoundingClientRect")
			.mockImplementation(function getBoundingClientRect() {
				return { width: widths.get(this.textContent) ?? 0 };
			});
	});

	afterEach(() => {
		cleanup?.();
		rectSpy?.mockRestore();
		vi.unstubAllGlobals();
	});

	it("reserves the widest stepped value and prepares a one-time scroll animation", () => {
		renderStats();
		const { gsap, timelines } = createGsap();
		const ScrollTrigger = { refresh: vi.fn() };

		cleanup = initStats(document, gsap, ScrollTrigger);

		const component = document.querySelector('[data-stats="component"]');
		const value = document.querySelector('[data-stats="value"]');
		const [prefix, , suffix] = document.querySelector(".stat").children;
		expect(timelines).toHaveLength(1);
		expect(timelines[0].config.scrollTrigger).toEqual({
			trigger: component,
			start: "top 80%",
			once: true,
		});
		expect(timelines[0].entries).toHaveLength(1);
		expect(timelines[0].entries[0]).toMatchObject({
			target: value,
			position: 0,
			variables: {
				textContent: 108,
				snap: { textContent: 1 },
			},
		});
		expect(value.textContent).toBe("108");
		expect(value.style.width).toBe("36px");
		expect(value.style.display).toBe("inline-block");
		expect(value.style.textAlign).toBe("center");
		expect(prefix.textContent).toBe("£");
		expect(suffix.textContent).toBe("m+");
		expect(gsap.registerPlugin).toHaveBeenCalledWith(ScrollTrigger);
		expect(ScrollTrigger.refresh).toHaveBeenCalledOnce();

		timelines[0].entries[0].variables.onComplete();
		expect(value.textContent).toBe("111");
	});

	it("staggers values in DOM order and keeps decimal increments precise", () => {
		renderValues([
			{ start: 0, increment: 1, end: 23 },
			{ start: 0, increment: 0.1, end: 5.1 },
		]);
		const { gsap, timelines } = createGsap();

		cleanup = initStats(document, gsap, { refresh: vi.fn() });

		expect(timelines[0].entries.map(({ position }) => position)).toEqual([0, 0.15]);
		expect(timelines[0].entries[1].variables.snap).toEqual({ textContent: 0.1 });
		const decimalValue = document.querySelectorAll('[data-stats="value"]')[1];
		decimalValue.textContent = "0.30000000000000004";
		timelines[0].entries[1].variables.onUpdate();
		expect(decimalValue.textContent).toBe("0.3");
		timelines[0].entries[1].variables.onComplete();
		expect(decimalValue.textContent).toBe("5.1");
	});

	it("uses a conservative width for ranges too large to measure step by step", () => {
		renderValues([{ start: 0, increment: 1, end: 11111 }]);
		rectSpy.mockImplementation(function getBoundingClientRect() {
			const digitWidths = {
				0: 9,
				1: 4,
				2: 7,
				3: 7,
				4: 8,
				5: 7,
				6: 8,
				7: 6,
				8: 10,
				9: 9,
			};
			return {
				width: [...this.textContent].reduce(
					(total, character) => total + (digitWidths[character] ?? 3),
					0,
				),
			};
		});
		const { gsap } = createGsap();

		cleanup = initStats(document, gsap, { refresh: vi.fn() });

		expect(document.querySelector('[data-stats="value"]').style.width).toBe("50px");
	});

	it("shows final values without creating animations when reduced motion is preferred", () => {
		renderValues([{ start: 0, increment: 1, end: 23 }]);
		vi.stubGlobal(
			"matchMedia",
			vi.fn(() => ({ matches: true })),
		);
		const { gsap, timelines } = createGsap();

		cleanup = initStats(document, gsap, { refresh: vi.fn() });

		const value = document.querySelector('[data-stats="value"]');
		expect(timelines).toHaveLength(0);
		expect(value.textContent).toBe("23");
		expect(value.style.width).toBe("");
	});

	it("restores authored content and styles during cleanup", () => {
		renderValues([{ start: 0, increment: 1, end: 23 }]);
		const value = document.querySelector('[data-stats="value"]');
		value.style.cssText = "display: block; width: 12px; text-align: right; white-space: normal";
		const { gsap, timelines } = createGsap();

		cleanup = initStats(document, gsap, { refresh: vi.fn() });
		cleanup();
		cleanup = null;

		expect(value.textContent).toBe("23");
		expect(value.style.display).toBe("block");
		expect(value.style.width).toBe("12px");
		expect(value.style.textAlign).toBe("right");
		expect(value.style.whiteSpace).toBe("normal");
		expect(timelines[0].scrollTrigger.kill).toHaveBeenCalledOnce();
		expect(timelines[0].kill).toHaveBeenCalledOnce();
	});

	it("skips malformed values and reports the data attribute problem", () => {
		document.body.innerHTML = `
			<section data-stats="component">
				<span data-stats="value" data-start="0" data-increment="0">23</span>
			</section>
		`;
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const { gsap, timelines } = createGsap();

		cleanup = initStats(document, gsap, { refresh: vi.fn() });

		expect(timelines).toHaveLength(0);
		expect(warn).toHaveBeenCalledWith(
			"[stats] Skipped a value because it needs a numeric final value, a numeric data-start, and a positive data-increment.",
		);
	});
});
