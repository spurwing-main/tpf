import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initWhatsappPin } from "./whatsapp-pin.js";

function createScrollTriggerHarness({ mobile = true } = {}) {
	const created = [];
	let mediaCleanup;

	const media = {
		add: vi.fn((query, callback) => {
			if (mobile) mediaCleanup = callback();
		}),
		revert: vi.fn(() => {
			mediaCleanup?.();
			mediaCleanup = undefined;
		}),
	};

	const gsap = {
		matchMedia: vi.fn(() => media),
		registerPlugin: vi.fn(),
	};
	const ScrollTrigger = {
		create: vi.fn((config) => {
			const trigger = { kill: vi.fn() };
			created.push({ config, trigger });
			return trigger;
		}),
	};

	return { created, gsap, media, ScrollTrigger };
}

function createHeroMarkup() {
	document.body.innerHTML = `
		<section data-whatsapp-pin-trigger>
			<div data-whatsapp-pin><button data-whatsapp>First</button></div>
		</section>
	`;
}

describe("whatsapp pin", () => {
	let cleanup;

	beforeEach(() => {
		createHeroMarkup();
		cleanup = undefined;
	});

	afterEach(() => {
		cleanup?.();
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	it("pins each wrapper to its attributed hero at the bottom of the hero", () => {
		const { created, gsap, media, ScrollTrigger } = createScrollTriggerHarness();

		cleanup = initWhatsappPin(document, gsap, ScrollTrigger);

		expect(gsap.matchMedia).toHaveBeenCalledOnce();
		expect(gsap.registerPlugin).toHaveBeenCalledWith(ScrollTrigger);
		expect(media.add).toHaveBeenCalledWith("(max-width: 767px)", expect.any(Function));
		expect(created).toHaveLength(1);
		expect(created[0].config).toMatchObject({
			trigger: document.querySelector("[data-whatsapp-pin-trigger]"),
			start: "bottom bottom",
			end: "max",
			pin: document.querySelector("[data-whatsapp-pin]"),
			pinSpacing: false,
			invalidateOnRefresh: true,
		});

		cleanup();
	});

	it("only creates pinning while the media query matches mobile widths", () => {
		const { created, gsap, ScrollTrigger } = createScrollTriggerHarness({ mobile: false });

		cleanup = initWhatsappPin(document, gsap, ScrollTrigger);

		expect(gsap.matchMedia).toHaveBeenCalledOnce();
		expect(created).toHaveLength(0);
		expect(ScrollTrigger.create).not.toHaveBeenCalled();

		cleanup();
	});

	it("creates independent triggers for multiple attributed heroes", () => {
		document.body.insertAdjacentHTML(
			"beforeend",
			`<section data-whatsapp-pin-trigger>
				<div data-whatsapp-pin><button data-whatsapp>Second</button></div>
			</section>`,
		);
		const { created, gsap, ScrollTrigger } = createScrollTriggerHarness();

		cleanup = initWhatsappPin(document, gsap, ScrollTrigger);

		expect(created).toHaveLength(2);
		expect(created.map(({ config }) => config.trigger)).toEqual(
			[...document.querySelectorAll("[data-whatsapp-pin-trigger]")],
		);
		expect(created.map(({ config }) => config.pin)).toEqual(
			[...document.querySelectorAll("[data-whatsapp-pin]")],
		);

		cleanup();
	});

	it("skips wrappers without triggers and warns once per initialization", () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
		document.body.insertAdjacentHTML(
			"beforeend",
			`<div data-whatsapp-pin><button data-whatsapp>Orphan</button></div>`,
		);
		document.body.insertAdjacentHTML(
			"beforeend",
			`<div data-whatsapp-pin><button data-whatsapp>Second orphan</button></div>`,
		);
		const { created, gsap, ScrollTrigger } = createScrollTriggerHarness();

		cleanup = initWhatsappPin(document, gsap, ScrollTrigger);

		expect(created).toHaveLength(1);
		expect(warning).toHaveBeenCalledOnce();
		expect(warning.mock.calls[0][0]).toContain("data-whatsapp-pin-trigger");

		cleanup();
	});

	it("does not duplicate triggers when initialized twice", () => {
		const { created, gsap, ScrollTrigger } = createScrollTriggerHarness();

		const firstCleanup = initWhatsappPin(document, gsap, ScrollTrigger);
		const secondCleanup = initWhatsappPin(document, gsap, ScrollTrigger);

		expect(secondCleanup).toBe(firstCleanup);
		expect(created).toHaveLength(1);

		firstCleanup();
	});

	it("reverts the media context and kills every created trigger on cleanup", () => {
		const { created, gsap, media, ScrollTrigger } = createScrollTriggerHarness();

		cleanup = initWhatsappPin(document, gsap, ScrollTrigger);
		cleanup();
		cleanup();

		expect(media.revert).toHaveBeenCalledOnce();
		expect(created[0].trigger.kill).toHaveBeenCalledOnce();
	});

	it("fails safely when GSAP or ScrollTrigger is unavailable", () => {
		expect(() => initWhatsappPin(document, undefined, undefined)).not.toThrow();
	});

	it("allows a no-op initialization to be retried after cleanup", () => {
		const noOpCleanup = initWhatsappPin(document, undefined, undefined);
		noOpCleanup();
		const { created, gsap, ScrollTrigger } = createScrollTriggerHarness();

		initWhatsappPin(document, gsap, ScrollTrigger);

		expect(created).toHaveLength(1);
	});
});
