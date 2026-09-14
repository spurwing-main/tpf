import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initVideos } from "./videos.js";

vi.mock("plyr", () => ({ default: class PlyrDefaultDouble {} }));

class PlyrDouble {
	static instances = [];

	constructor(element, options = {}) {
		if (element.hasAttribute("data-video-invalid")) {
			throw new Error("Invalid player");
		}
		this.element = element;
		this.config = { ...options };
		this.ready = element.tagName === "VIDEO";
		this.stopped = false;
		this.destroyed = false;
		this.listeners = new Map();
		element.dataset.videoPlayerReady = "";
		PlyrDouble.instances.push(this);
	}

	play() {
		this.element.dataset.videoPlaying = "";
		return Promise.resolve();
	}

	stop() {
		if (!this.ready) return;
		this.stopped = true;
		delete this.element.dataset.videoPlaying;
	}

	destroy() {
		if (!this.ready) return;
		this.destroyed = true;
		delete this.element.dataset.videoPlayerReady;
	}

	once(event, callback) {
		this.listeners.set(event, callback);
	}

	emitReady() {
		this.ready = true;
		const callback = this.listeners.get("ready");
		this.listeners.delete("ready");
		callback?.();
	}

	emitError() {
		const callback = this.listeners.get("error");
		this.listeners.delete("error");
		callback?.();
	}
}

function renderVideoComponent(source) {
	document.body.innerHTML = `
		<section data-video-component>
			<button type="button" data-video-open>Play video</button>
			<template data-video-source>${source}</template>
		</section>
		<dialog data-modal data-video-dialog>
			<div data-modal-surface>
				<button type="button" data-video-close>Close video</button>
				<div data-video-mount></div>
			</div>
		</dialog>
	`;
}

describe("initVideos", () => {
	let cleanup;

	beforeEach(() => {
		document.body.innerHTML = "";
		PlyrDouble.instances = [];
		cleanup = null;
		HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
			this.setAttribute("open", "");
		});
		HTMLDialogElement.prototype.close = vi.fn(function close(returnValue = "") {
			this.returnValue = returnValue;
			this.removeAttribute("open");
			this.dispatchEvent(new Event("close"));
		});
	});

	afterEach(() => {
		cleanup?.();
		delete HTMLDialogElement.prototype.showModal;
		delete HTMLDialogElement.prototype.close;
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	it("opens the shared dialog and autoplays the component video", () => {
		renderVideoComponent(`
			<video controls playsinline>
				<source src="https://media.example.com/film.mp4" type="video/mp4">
				<source src="https://media.example.com/film.webm" type="video/webm">
			</video>
		`);

		cleanup = initVideos(document, PlyrDouble);
		document.querySelector("[data-video-open]").click();

		expect(document.querySelector("[data-video-dialog]").open).toBe(true);
		expect(document.querySelector("[data-video-mount] video")).not.toBeNull();
		expect(document.querySelector("[data-video-playing]")).not.toBeNull();
		expect(PlyrDouble.instances).toHaveLength(1);
	});

	it("stops and removes the player when the close button closes the dialog", () => {
		renderVideoComponent('<video controls playsinline src="https://media.example.com/film.mp4"></video>');
		cleanup = initVideos(document, PlyrDouble);
		document.querySelector("[data-video-open]").click();
		const player = PlyrDouble.instances[0];

		document.querySelector("[data-video-close]").click();

		expect(document.querySelector("[data-video-dialog]").open).toBe(false);
		expect(document.querySelector("[data-video-mount]").children).toHaveLength(0);
		expect(player.stopped).toBe(true);
		expect(player.destroyed).toBe(true);
	});

	it("warns and leaves the dialog closed when a component has no video source", () => {
		renderVideoComponent("");
		const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
		cleanup = initVideos(document, PlyrDouble);

		document.querySelector("[data-video-open]").click();

		expect(warning).toHaveBeenCalledOnce();
		expect(document.querySelector("[data-video-dialog]").open).toBe(false);
		expect(PlyrDouble.instances).toHaveLength(0);
	});

	it("rejects unsupported provider markup before opening the dialog", () => {
		renderVideoComponent(
			'<div data-plyr-provider="dailymotion" data-plyr-embed-id="video-id"></div>',
		);
		const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
		cleanup = initVideos(document, PlyrDouble);

		document.querySelector("[data-video-open]").click();

		expect(document.querySelector("[data-video-dialog]").open).toBe(false);
		expect(PlyrDouble.instances).toHaveLength(0);
		expect(warning).toHaveBeenCalledOnce();
	});

	it("initializes each root only once", () => {
		renderVideoComponent(
			'<video controls src="https://media.example.com/film.mp4"></video>',
		);
		const firstCleanup = initVideos(document, PlyrDouble);
		const secondCleanup = initVideos(document, PlyrDouble);
		cleanup = () => {
			firstCleanup();
			secondCleanup();
		};

		document.querySelector("[data-video-open]").click();

		expect(PlyrDouble.instances).toHaveLength(1);
	});

	it.each(["youtube", "vimeo"])(
		"destroys a %s provider after it becomes ready when closed during startup",
		(provider) => {
			renderVideoComponent(
				`<div data-plyr-provider="${provider}" data-plyr-embed-id="video-id"></div>`,
			);
			cleanup = initVideos(document, PlyrDouble);
			document.querySelector("[data-video-open]").click();
			const player = PlyrDouble.instances[0];

			document.querySelector("[data-video-close]").click();

			expect(document.querySelector("[data-video-dialog]").open).toBe(false);
			expect(document.querySelector("[data-video-mount]").children).toHaveLength(0);
			expect(player.config.autoplay).toBe(false);
			expect(player.destroyed).toBe(false);

			player.emitReady();
			expect(player.stopped).toBe(true);
			expect(player.destroyed).toBe(true);
		},
	);

	it("closes an external-provider dialog when the player never becomes ready", () => {
		vi.useFakeTimers();
		renderVideoComponent(
			'<div data-plyr-provider="youtube" data-plyr-embed-id="youtube-id"></div>',
		);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		cleanup = initVideos(document, PlyrDouble, { readyTimeout: 1000 });
		document.querySelector("[data-video-open]").click();
		const player = PlyrDouble.instances[0];

		vi.advanceTimersByTime(1000);

		expect(document.querySelector("[data-video-dialog]").open).toBe(false);
		expect(document.querySelector("[data-video-mount]").children).toHaveLength(0);
		expect(player.config.autoplay).toBe(false);
		expect(error).toHaveBeenCalledOnce();
	});

	it("closes the dialog when an external provider reports an error", () => {
		renderVideoComponent(
			'<div data-plyr-provider="vimeo" data-plyr-embed-id="video-id"></div>',
		);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		cleanup = initVideos(document, PlyrDouble);
		document.querySelector("[data-video-open]").click();
		const player = PlyrDouble.instances[0];

		player.emitError();

		expect(document.querySelector("[data-video-dialog]").open).toBe(false);
		expect(document.querySelector("[data-video-mount]").children).toHaveLength(0);
		expect(player.config.autoplay).toBe(false);
		expect(error).toHaveBeenCalledOnce();
	});

	it("closes the dialog and remains usable when Plyr cannot initialize a source", () => {
		renderVideoComponent(
			'<video data-video-invalid controls src="https://media.example.com/invalid.mp4"></video>',
		);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		cleanup = initVideos(document, PlyrDouble);
		const trigger = document.querySelector("[data-video-open]");

		trigger.click();

		expect(document.querySelector("[data-video-dialog]").open).toBe(false);
		expect(document.querySelector("[data-video-mount]").children).toHaveLength(0);
		expect(error).toHaveBeenCalledOnce();

		document.querySelector("[data-video-source]").innerHTML =
			'<video controls src="https://media.example.com/recovered.mp4"></video>';
		trigger.click();
		expect(document.querySelector("[data-video-dialog]").open).toBe(true);
		expect(document.querySelector("[data-video-playing]")).not.toBeNull();
	});
});
