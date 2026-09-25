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

	it("splits a media reveal across the wrapper and its image child", () => {
		document.body.innerHTML = '<figure data-reveal="media"><img alt="" /></figure>';
		const { gsap, timelines } = createGsap();

		cleanup = initReveals(document, gsap, null);

		const wrapper = document.querySelector("figure");
		const image = document.querySelector("img");
		expect(timelines[0].entries).toEqual([
			{
				method: "fromTo",
				target: wrapper,
				from: { clipPath: "inset(0 0 100% 0)" },
				to: {
					clipPath: "inset(0 0 0% 0)",
					duration: 1.3,
					ease: "power3.inOut",
					clearProps: "clipPath",
				},
				position: 0,
			},
			{
				method: "fromTo",
				target: wrapper,
				from: { autoAlpha: 0 },
				to: {
					autoAlpha: 1,
					duration: 0.9,
					ease: "power4.out",
					clearProps: "opacity,visibility",
				},
				position: 0,
			},
			{
				method: "fromTo",
				target: image,
				from: { scale: 1.04 },
				to: {
					scale: 1,
					duration: 0.9,
					ease: "power4.out",
					clearProps: "transform",
				},
				position: 0,
			},
		]);
	});

	it("keeps direct image media reveals backwards compatible", () => {
		document.body.innerHTML = '<img data-reveal="media" alt="" />';
		const { gsap, timelines } = createGsap();

		cleanup = initReveals(document, gsap, null);

		const image = document.querySelector("img");
		expect(timelines[0].entries).toHaveLength(3);
		expect(timelines[0].entries[2]).toMatchObject({
			method: "fromTo",
			target: image,
			from: { scale: 1.04 },
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

	it("initializes reveals only for newly rendered Finsweet list items", async () => {
		document.body.innerHTML = `
			<div fs-list-element="list">
				<article class="w-dyn-item" id="existing-item">
					<div data-reveal-group>
						<div data-reveal="fade">Existing</div>
					</div>
				</article>
			</div>
		`;
		const existingItem = document.querySelector("#existing-item");
		const existingListItem = { element: existingItem };
		let afterRender;
		const removeHook = vi.fn();
		const listInstance = {
			renderedItems: new Set([existingListItem]),
			addHook: vi.fn((name, handler) => {
				if (name === "afterRender") afterRender = handler;
				return removeHook;
			}),
		};
		const FinsweetAttributes = {
			push: vi.fn(([name, callback]) => {
				if (name === "list") callback([listInstance]);
			}),
		};
		const { gsap } = createGsap();
		const ScrollTrigger = {
			create: vi.fn(() => ({ kill: vi.fn() })),
			refresh: vi.fn(),
		};

		cleanup = initReveals(document, gsap, ScrollTrigger, FinsweetAttributes);
		expect(ScrollTrigger.create).toHaveBeenCalledOnce();

		const newItem = document.createElement("article");
		newItem.className = "w-dyn-item";
		newItem.innerHTML = `
			<div data-reveal-group>
				<div data-reveal="fade">New</div>
			</div>
		`;
		document.querySelector('[fs-list-element="list"]').append(newItem);
		const renderedItems = [existingListItem, { element: newItem }];

		await afterRender(renderedItems);

		expect(ScrollTrigger.create).toHaveBeenCalledTimes(2);
		expect(ScrollTrigger.create.mock.calls[1][0].trigger).toBe(
			newItem.querySelector("[data-reveal-group]"),
		);
		expect(ScrollTrigger.refresh).toHaveBeenCalledOnce();

		await afterRender(renderedItems);
		expect(ScrollTrigger.create).toHaveBeenCalledTimes(2);
		expect(ScrollTrigger.refresh).toHaveBeenCalledOnce();

		cleanup();
		cleanup = null;
		expect(removeHook).toHaveBeenCalledOnce();
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

	it("clears both media layers when reduced motion is enabled", () => {
		document.body.innerHTML = '<figure data-reveal="media"><img alt="" /></figure>';
		const wrapper = document.querySelector("figure");
		const image = document.querySelector("img");
		const { gsap, media } = createGsap({ withMatchMedia: true });

		cleanup = initReveals(document, gsap, null);
		media.activate(true);

		expect(gsap.set).toHaveBeenCalledWith(wrapper, {
			clearProps: "opacity,visibility,transform,clipPath",
		});
		expect(gsap.set).toHaveBeenCalledWith(image, {
			clearProps: "opacity,visibility,transform,clipPath",
		});
	});
});
