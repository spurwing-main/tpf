import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initReveals } from "./reveals.js";

function createGsap({ withMatchMedia = false } = {}) {
	const timelines = [];
	let mediaHandler = null;
	let mediaCleanup = null;
	const media = {
		add: vi.fn((queries, handler) => {
			mediaHandler = handler;
			media.activate(false);
			return media;
		}),
		activate(reduceMotion) {
			mediaCleanup?.();
			mediaCleanup =
				mediaHandler?.({
					conditions: { allowMotion: !reduceMotion, reduceMotion },
				}) ?? null;
		},
		revert: vi.fn(() => {
			mediaCleanup?.();
			mediaCleanup = null;
		}),
	};
	const gsap = {
		fromTo: vi.fn(),
		registerPlugin: vi.fn(),
		set: vi.fn(),
		timeline: vi.fn((config) => {
			const timeline = {
				config,
				entries: [],
				from(target, variables, position) {
					this.entries.push({ method: "from", target, variables, position });
					return this;
				},
				fromTo(target, from, to, position) {
					this.entries.push({ method: "fromTo", target, from, to, position });
					return this;
				},
				kill: vi.fn(),
				play: vi.fn(),
			};
			timelines.push(timeline);
			return timeline;
		}),
	};
	if (withMatchMedia) gsap.matchMedia = vi.fn(() => media);

	return { gsap, media, timelines };
}

describe("initReveals", () => {
	let cleanup;

	beforeEach(() => {
		document.body.innerHTML = "";
		document.documentElement.classList.remove("tpf-intro-active");
		document.documentElement.removeAttribute("data-intro-reveal-ready");
		cleanup = null;
		vi.restoreAllMocks();
	});

	afterEach(() => {
		cleanup?.();
		document.documentElement.classList.remove("tpf-intro-active");
		document.documentElement.removeAttribute("data-intro-reveal-ready");
	});

	it("waits for the intro handoff when a standalone reveal uses the load trigger", () => {
		document.body.innerHTML = '<h1 data-reveal="up" data-reveal-trigger="load">Hello</h1>';
		document.documentElement.classList.add("tpf-intro-active");
		const { gsap, timelines } = createGsap();
		const ScrollTrigger = { create: vi.fn() };

		cleanup = initReveals(document, gsap, ScrollTrigger);

		expect(ScrollTrigger.create).not.toHaveBeenCalled();
		expect(timelines[0].play).not.toHaveBeenCalled();

		document.documentElement.dispatchEvent(new CustomEvent("tpf:intro:reveal"));
		expect(timelines[0].play).toHaveBeenCalledOnce();
	});

	it("starts a rebuilt load reveal when the intro handoff already occurred", () => {
		document.body.innerHTML = '<h1 data-reveal="up" data-reveal-trigger="load">Hello</h1>';
		document.documentElement.classList.add("tpf-intro-active");
		document.documentElement.setAttribute("data-intro-reveal-ready", "");
		const { gsap, timelines } = createGsap();

		cleanup = initReveals(document, gsap, null);

		expect(timelines[0].play).toHaveBeenCalledOnce();
	});

	it("animates standard reveals back to their authored state and clears reveal styles", () => {
		document.body.innerHTML = '<div data-reveal="up">Content</div>';
		const { gsap, timelines } = createGsap();

		cleanup = initReveals(document, gsap, null);

		expect(timelines[0].entries[0]).toMatchObject({
			method: "from",
			variables: {
				autoAlpha: 0,
				y: 28,
				clearProps: "opacity,visibility,transform",
			},
		});
	});

	it("supports the media curtain preset without retaining clip or transform styles", () => {
		document.body.innerHTML = '<figure data-reveal="media"><img alt="" /></figure>';
		const { gsap, timelines } = createGsap();

		cleanup = initReveals(document, gsap, null);

		expect(timelines[0].entries[0]).toMatchObject({
			method: "fromTo",
			from: {
				clipPath: "inset(0 0 100% 0)",
				scale: 1.04,
			},
			to: {
				clipPath: "inset(0 0 0% 0)",
				scale: 1,
				duration: 0.85,
				ease: "power3.inOut",
				clearProps: "clipPath,transform",
			},
		});
	});

	it("caps the total stagger across a reveal group", () => {
		document.body.innerHTML = `
			<div data-reveal-group data-reveal-stagger="200">
				<div data-reveal="up">One</div>
				<div data-reveal="up">Two</div>
				<div data-reveal="up">Three</div>
				<div data-reveal="up">Four</div>
				<div data-reveal="up">Five</div>
				<div data-reveal="up">Six</div>
			</div>
		`;
		const { gsap, timelines } = createGsap();

		cleanup = initReveals(document, gsap, null);

		expect(timelines[0].entries.map(({ position }) => position)).toEqual([
			0,
			0.08,
			0.16,
			0.24,
			0.32,
			0.4,
		]);
	});

	it("creates one-time scroll triggers for grouped and standalone reveals", () => {
		document.body.innerHTML = `
			<section data-reveal-group>
				<h2 data-reveal="up">Grouped</h2>
			</section>
			<p data-reveal="fade">Standalone</p>
		`;
		const { gsap } = createGsap();
		const ScrollTrigger = {
			create: vi.fn(() => ({ kill: vi.fn() })),
		};

		cleanup = initReveals(document, gsap, ScrollTrigger);

		expect(ScrollTrigger.create).toHaveBeenCalledTimes(2);
		for (const [configuration] of ScrollTrigger.create.mock.calls) {
			expect(configuration.once).toBe(true);
		}
	});

	it("reconfigures reveals when the reduced-motion preference changes", () => {
		document.body.innerHTML = '<div data-reveal="up">Content</div>';
		const element = document.querySelector("[data-reveal]");
		const { gsap, media, timelines } = createGsap({ withMatchMedia: true });

		cleanup = initReveals(document, gsap, null);
		expect(timelines).toHaveLength(1);

		media.activate(true);
		expect(timelines[0].kill).toHaveBeenCalledOnce();
		expect(gsap.set).toHaveBeenCalledWith(element, {
			clearProps: "opacity,visibility,transform,clipPath",
		});

		media.activate(false);
		expect(timelines).toHaveLength(2);
	});
});
