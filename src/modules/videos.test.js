import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initPanelStack } from "./panel-stack.js";
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
		this.playCalls = 0;
		this.stopCalls = 0;
		this.listeners = new Map();
		element.dataset.videoPlayerReady = "";
		PlyrDouble.instances.push(this);
	}

	play() {
		this.playCalls += 1;
		this.element.dataset.videoPlaying = "";
		return Promise.resolve();
	}

	stop() {
		if (!this.ready) return;
		this.stopCalls += 1;
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

function inlineSource(name, attributes = "", media = `<video playsinline src="https://media.example.com/${name}.mp4"></video>`) {
	return `
		<div data-video-inline>
			<template data-video-source data-video-autoplay="true" ${attributes}>${media}</template>
			<div data-video-mount></div>
		</div>
	`;
}

function renderInlineStack({ sourceCount = 3, activeIndex = 0 } = {}) {
	document.body.innerHTML = `
		<section data-panel-stack>
			<div data-panel-stack-list>
				${Array.from({ length: sourceCount }, (_, index) => `
					<div data-panel-stack-item${index === activeIndex ? ' class="is-open"' : ""}>
						<div data-panel-stack-source>${inlineSource(`clip-${index}`)}</div>
					</div>
				` ).join("")}
			</div>
			<div data-panel-stack-stage></div>
		</section>
	`;
}

function dispatchPanelState(component, detail) {
	component.dispatchEvent(new CustomEvent("panel-stack:statechange", { bubbles: true, detail }));
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
	const setAutoAlpha = (targets, variables) => {
		if (variables.autoAlpha === undefined) return;
		for (const target of Array.isArray(targets) ? targets : [targets]) {
			target.style.opacity = String(variables.autoAlpha);
			target.style.visibility = variables.autoAlpha === 0 ? "hidden" : "inherit";
		}
	};
	return {
		set: vi.fn(setAutoAlpha),
		to: vi.fn((target, variables) => {
			setAutoAlpha(target, variables);
			return { kill: vi.fn() };
		}),
		killTweensOf: vi.fn(),
	};
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

	it("eagerly initializes every inline video and autoplays only the active source", () => {
		renderInlineStack();
		cleanup = initVideos(document, PlyrDouble);

		expect(PlyrDouble.instances).toHaveLength(3);
		expect(PlyrDouble.instances.map((player) => player.config.autoplay)).toEqual([
			false,
			false,
			false,
		]);
		expect(PlyrDouble.instances.map((player) => player.playCalls)).toEqual([1, 0, 0]);
		expect(PlyrDouble.instances.slice(1).every((player) => player.stopped)).toBe(true);
	});

	it("applies inline autoplay, loop, and muted settings when a source becomes active", () => {
		renderInlineStack({ sourceCount: 2 });
		const firstTemplate = document.querySelector("template[data-video-source]");
		firstTemplate.dataset.videoAutoplay = "false";
		firstTemplate.dataset.videoLoop = "true";
		firstTemplate.dataset.videoMuted = "true";
		cleanup = initVideos(document, PlyrDouble);

		const [firstPlayer] = PlyrDouble.instances;
		expect(firstPlayer.config.loop).toEqual({ active: true });
		expect(firstPlayer.config.muted).toBe(true);
		expect(firstPlayer.playCalls).toBe(0);
		expect(firstPlayer.element.muted).toBe(true);
	});

	it("stops and resets the old inline player before starting the new active source", () => {
		renderInlineStack({ sourceCount: 2 });
		cleanup = initVideos(document, PlyrDouble);
		const component = document.querySelector("[data-panel-stack]");
		const [firstSource, secondSource] = component.querySelectorAll("[data-panel-stack-source]");
		const [firstPlayer, secondPlayer] = PlyrDouble.instances;

		dispatchPanelState(component, {
			mode: "mobile",
			sources: [firstSource, secondSource],
			activeSource: secondSource,
			previousSource: firstSource,
		});

		expect(firstPlayer.stopCalls).toBe(1);
		expect(firstPlayer.stopped).toBe(true);
		expect(secondPlayer.playCalls).toBe(1);
	});

	it("keeps autoplay-disabled inline videos paused at the beginning", () => {
		renderInlineStack({ sourceCount: 1 });
		document.querySelector("template[data-video-source]").dataset.videoAutoplay = "false";
		cleanup = initVideos(document, PlyrDouble);

		expect(PlyrDouble.instances[0].playCalls).toBe(0);
		expect(PlyrDouble.instances[0].stopped).toBe(true);
	});

	it("suppresses inline autoplay when reduced motion is preferred", () => {
		renderInlineStack({ sourceCount: 1 });
		vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
		cleanup = initVideos(document, PlyrDouble);

		expect(PlyrDouble.instances[0].playCalls).toBe(0);
		expect(PlyrDouble.instances[0].stopped).toBe(true);
	});

	it.each(["youtube", "vimeo"])(
		"disposes an inline %s player switched away before provider readiness",
		(provider) => {
			renderInlineStack({ sourceCount: 2 });
			const templates = document.querySelectorAll("template[data-video-source]");
			templates[0].innerHTML = `<div data-plyr-provider="${provider}" data-plyr-embed-id="video-id"></div>`;
			cleanup = initVideos(document, PlyrDouble);
			const component = document.querySelector("[data-panel-stack]");
			const sources = [...component.querySelectorAll("[data-panel-stack-source]")];
			const firstPlayer = PlyrDouble.instances[0];

			dispatchPanelState(component, {
				mode: "mobile",
				sources,
				activeSource: sources[1],
				previousSource: sources[0],
			});

			expect(firstPlayer.config.autoplay).toBe(false);
			expect(firstPlayer.destroyed).toBe(false);
			firstPlayer.emitReady();
			expect(firstPlayer.stopped).toBe(true);
			expect(firstPlayer.destroyed).toBe(false);
		},
	);

	it("isolates an inline provider error to the failed player", () => {
		renderInlineStack({ sourceCount: 2 });
		const templates = document.querySelectorAll("template[data-video-source]");
		templates[0].innerHTML = '<div data-plyr-provider="youtube" data-plyr-embed-id="bad-id"></div>';
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		cleanup = initVideos(document, PlyrDouble);
		const [failedPlayer, healthyPlayer] = PlyrDouble.instances;

		failedPlayer.emitError();

		expect(error).toHaveBeenCalledOnce();
		expect(healthyPlayer.destroyed).toBe(false);
		expect(healthyPlayer.playCalls).toBe(0);
	});

	it("destroys every inline player and clears mounts during cleanup", () => {
		renderInlineStack();
		cleanup = initVideos(document, PlyrDouble);

		cleanup();
		cleanup = null;

		expect(PlyrDouble.instances.every((player) => player.destroyed)).toBe(true);
		expect(document.querySelectorAll("[data-video-mount]")).toHaveLength(3);
		expect([...document.querySelectorAll("[data-video-mount]")].every((mount) => !mount.hasChildNodes())).toBe(
			true,
		);
	});

	it("integrates with panel-stack without initializing authored and desktop clone videos together", async () => {
		renderInlineStack();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		const panelCleanup = initPanelStack(document, createGsap());
		cleanup = initVideos(document, PlyrDouble);

		expect(PlyrDouble.instances).toHaveLength(3);
		expect(document.querySelectorAll("[data-panel-stack-item] [data-video-player-ready]")).toHaveLength(0);

		const [first, second] = document.querySelectorAll("[data-panel-stack-item]");
		first.classList.remove("is-open");
		second.classList.add("is-open");
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(PlyrDouble.instances[0].stopped).toBe(true);
		expect(PlyrDouble.instances[1].playCalls).toBe(1);
		panelCleanup();
	});

	it("destroys clone players when panel-stack changes to its authored mobile surface", () => {
		renderInlineStack();
		const mediaQuery = createMatchMedia(true);
		vi.stubGlobal(
			"matchMedia",
			vi.fn((query) => (query === "(min-width: 768px)" ? mediaQuery : { matches: false })),
		);
		const panelCleanup = initPanelStack(document, createGsap());
		cleanup = initVideos(document, PlyrDouble);
		const desktopPlayers = [...PlyrDouble.instances];

		mediaQuery.setMatches(false);

		expect(desktopPlayers.every((player) => player.destroyed)).toBe(true);
		expect(PlyrDouble.instances).toHaveLength(6);
		expect(document.querySelectorAll('[data-panel-stack-generated="source"] [data-video-player-ready]')).toHaveLength(0);
		expect(document.querySelectorAll("[data-panel-stack-item] [data-video-player-ready]")).toHaveLength(3);
		panelCleanup();
	});
});
