import { beforeEach, describe, expect, it } from "vitest";
import { initNavScrollState } from "./nav-scroll.js";

describe("initNavScrollState", () => {
	beforeEach(() => {
		document.body.innerHTML = "<nav></nav>";
		document.documentElement.className = "";
		Object.defineProperty(window, "scrollY", { configurable: true, value: 0, writable: true });
	});

	it("adds the scrolled class after scrolling down past the threshold", () => {
		const target = document.documentElement;
		const cleanup = initNavScrollState(document);

		window.scrollY = 25;
		window.dispatchEvent(new Event("scroll"));

		expect(target.classList.contains("is-scrolled")).toBe(true);
		cleanup();
	});

	it("initializes the class when the page is already past the threshold", () => {
		const target = document.documentElement;
		window.scrollY = 25;

		const cleanup = initNavScrollState(document);

		expect(target.classList.contains("is-scrolled")).toBe(true);
		cleanup();
	});

	it("removes the class after scrolling up by the configured distance", () => {
		const target = document.documentElement;
		const cleanup = initNavScrollState(document);

		window.scrollY = 100;
		window.dispatchEvent(new Event("scroll"));
		expect(target.classList.contains("is-scrolled")).toBe(true);

		window.scrollY = 75;
		window.dispatchEvent(new Event("scroll"));
		expect(target.classList.contains("is-scrolled")).toBe(false);
		cleanup();
	});

	it("shows the nav immediately when scrolling back to threshold A", () => {
		const target = document.documentElement;
		const cleanup = initNavScrollState(document);

		window.scrollY = 100;
		window.dispatchEvent(new Event("scroll"));
		window.scrollY = 24;
		window.dispatchEvent(new Event("scroll"));

		expect(target.classList.contains("is-scrolled")).toBe(false);
		cleanup();
	});

	it("always applies the fixed class to the document", () => {
		const cleanup = initNavScrollState(document);

		window.scrollY = 25;
		window.dispatchEvent(new Event("scroll"));

		expect(document.documentElement.classList.contains("is-scrolled")).toBe(true);
		cleanup();
	});
});
