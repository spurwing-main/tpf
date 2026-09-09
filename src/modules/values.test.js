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
	return {
		set: vi.fn(),
		to: vi.fn(() => ({ kill: vi.fn() })),
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
});
