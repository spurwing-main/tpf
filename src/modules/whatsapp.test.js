import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initWhatsapp } from "./whatsapp.js";

describe("whatsapp", () => {
	let cleanup;
	let openWindow;

	beforeEach(() => {
		document.body.innerHTML = `
			<button
				type="button"
				data-whatsapp
				data-whatsapp-number="447398469961"
				data-whatsapp-message="Hello, I’d like to learn more."
			>
				WhatsApp us
			</button>
		`;
		openWindow = vi.spyOn(window, "open").mockImplementation(() => null);
	});

	afterEach(() => {
		cleanup?.();
		vi.restoreAllMocks();
	});

	it("opens the configured number with an encoded prefilled message", () => {
		cleanup = initWhatsapp(document);

		document.querySelector("[data-whatsapp]").click();

		expect(openWindow).toHaveBeenCalledWith(
			"https://api.whatsapp.com/send?phone=447398469961&text=Hello%2C%20I%E2%80%99d%20like%20to%20learn%20more.",
			"_blank",
			"noopener",
		);
	});

	it("normalizes a leading international dialing prefix", () => {
		const button = document.querySelector("[data-whatsapp]");
		button.dataset.whatsappNumber = "00447867637854";
		cleanup = initWhatsapp(document);

		button.click();

		expect(openWindow).toHaveBeenCalledWith(
			"https://api.whatsapp.com/send?phone=447867637854&text=Hello%2C%20I%E2%80%99d%20like%20to%20learn%20more.",
			"_blank",
			"noopener",
		);
	});

	it("encodes punctuation, ampersands, and line breaks in the message", () => {
		const button = document.querySelector("[data-whatsapp]");
		button.dataset.whatsappMessage = "Line one & line two?\nThanks!";
		cleanup = initWhatsapp(document);

		button.click();

		expect(openWindow).toHaveBeenCalledWith(
			"https://api.whatsapp.com/send?phone=447398469961&text=Line%20one%20%26%20line%20two%3F%0AThanks!",
			"_blank",
			"noopener",
		);
	});

	it("opens multiple independently configured buttons", () => {
		document.body.insertAdjacentHTML(
			"beforeend",
			`<button
				type="button"
				data-whatsapp
				data-whatsapp-number="14155552671"
				data-whatsapp-message="Second button"
			>Second</button>`,
		);
		cleanup = initWhatsapp(document);

		const buttons = document.querySelectorAll("[data-whatsapp]");
		buttons[0].click();
		buttons[1].click();

		expect(openWindow).toHaveBeenNthCalledWith(
			1,
			"https://api.whatsapp.com/send?phone=447398469961&text=Hello%2C%20I%E2%80%99d%20like%20to%20learn%20more.",
			"_blank",
			"noopener",
		);
		expect(openWindow).toHaveBeenNthCalledWith(
			2,
			"https://api.whatsapp.com/send?phone=14155552671&text=Second%20button",
			"_blank",
			"noopener",
		);
	});

	it("reads changed attributes at click time", () => {
		const button = document.querySelector("[data-whatsapp]");
		cleanup = initWhatsapp(document);
		button.dataset.whatsappNumber = "33123456789";
		button.dataset.whatsappMessage = "Updated message";

		button.click();

		expect(openWindow).toHaveBeenCalledWith(
			"https://api.whatsapp.com/send?phone=33123456789&text=Updated%20message",
			"_blank",
			"noopener",
		);
	});

	it("warns and does nothing for incomplete or invalid configurations", () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
		document.body.insertAdjacentHTML(
			"beforeend",
			`<div>
				<button data-whatsapp data-whatsapp-message="Missing number">Missing number</button>
				<button data-whatsapp data-whatsapp-number="+44123456789" data-whatsapp-message="Bad number">Bad number</button>
				<button data-whatsapp data-whatsapp-number="447398469961">Missing message</button>
			</div>`,
		);
		cleanup = initWhatsapp(document);

		document
			.querySelector("[data-whatsapp] + div")
			?.querySelectorAll("[data-whatsapp]")
			.forEach((button) => button.click());

		expect(openWindow).not.toHaveBeenCalled();
		expect(warning).toHaveBeenCalledTimes(3);
	});

	it("does not attach duplicate handlers when initialized twice", () => {
		initWhatsapp(document);
		cleanup = initWhatsapp(document);

		document.querySelector("[data-whatsapp]").click();

		expect(openWindow).toHaveBeenCalledOnce();
	});
});
