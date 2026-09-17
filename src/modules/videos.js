import Plyr from "plyr";
import { closeDialog, openDialog } from "./dialogs.js";

const COMPONENT_SELECTOR = "[data-video-component]";
const CLOSE_SELECTOR = "[data-video-close]";
const DIALOG_SELECTOR = "dialog[data-video-dialog]";
const MOUNT_SELECTOR = "[data-video-mount]";
const OPEN_SELECTOR = "[data-video-open]";
const READY_TIMEOUT = 10000;
const SOURCE_SELECTOR = "template[data-video-source]";
const VIDEO_PROVIDERS = new Set(["youtube", "vimeo"]);
const INLINE_SELECTOR = "[data-video-inline]";
const PANEL_STACK_SELECTOR = "[data-panel-stack]";
const PANEL_STACK_STATE_EVENT = "panel-stack:statechange";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const initializedRoots = new WeakMap();

function getOwnerDocument(root) {
	return root.nodeType === 9 ? root : root.ownerDocument;
}

function hasTextAttribute(element, name) {
	return Boolean(element.getAttribute(name)?.trim());
}

function parseBooleanAttribute(element, name, fallback = false) {
	const value = element.getAttribute(name)?.trim().toLowerCase();
	if (value === "true") return true;
	if (value === "false") return false;
	return fallback;
}

function getMatchingTree(root, selector) {
	return [
		...(root.matches?.(selector) ? [root] : []),
		...(root.querySelectorAll?.(selector) ?? []),
	];
}

function getOwnedMatches(root, selector, ownerSelector) {
	return [...root.querySelectorAll(selector)].filter(
		(element) => element.closest(ownerSelector) === root,
	);
}

function getMedia(fragment) {
	if (fragment.children.length !== 1) return null;

	const media = fragment.firstElementChild;
	if (media.tagName === "VIDEO") {
		const hasSource =
			hasTextAttribute(media, "src") ||
			[...media.querySelectorAll("source")].some((source) => hasTextAttribute(source, "src"));
		return hasSource ? media : null;
	}

	if (media.tagName === "DIV") {
		const provider = media.getAttribute("data-plyr-provider");
		return VIDEO_PROVIDERS.has(provider) && hasTextAttribute(media, "data-plyr-embed-id")
			? media
			: null;
	}

	return null;
}

export function initVideos(root = document, PlyrConstructor = Plyr, options = {}) {
	const existingCleanup = initializedRoots.get(root);
	if (existingCleanup) return existingCleanup;

	const ownerDocument = getOwnerDocument(root);
	let activePlayer = null;
	const playerStates = new WeakMap();
	const inlineByWrapper = new WeakMap();
	const inlineRecords = new Set();
	const warnedInlineElements = new WeakSet();
	const readyTimeout = options.readyTimeout ?? READY_TIMEOUT;

	function destroyPlayer(player) {
		try {
			player.stop();
		} catch (error) {
			console.error("[videos] Player did not stop cleanly.", error);
		}

		try {
			player.destroy();
		} catch (error) {
			console.error("[videos] Player did not destroy cleanly.", error);
		}
	}

	function disposePlayer(player) {
		if (!player) return;
		if (player.ready) {
			destroyPlayer(player);
			return;
		}

		if (player.config) player.config.autoplay = false;
		const state = playerStates.get(player);
		if (state) {
			state.disposed = true;
			clearTimeout(state.timer);
		}
	}

	function watchPlayer(player, dialog) {
		if (player.ready) return;

		const state = {
			disposed: false,
			timer: setTimeout(() => {
				if (activePlayer !== player) return;
				console.error("[videos] Player did not become ready in time.");
				closeDialog(dialog, "error");
			}, readyTimeout),
		};
		playerStates.set(player, state);

		player.once("ready", () => {
			clearTimeout(state.timer);
			playerStates.delete(player);
			if (state.disposed) destroyPlayer(player);
		});
		player.once("error", () => {
			if (activePlayer !== player) return;
			console.error("[videos] The video provider reported an error.");
			closeDialog(dialog, "error");
		});
	}

	function clearPlayer(dialog = ownerDocument.querySelector(DIALOG_SELECTOR)) {
		disposePlayer(activePlayer);
		activePlayer = null;
		dialog?.querySelector(MOUNT_SELECTOR)?.replaceChildren();
	}

	function prefersReducedMotion() {
		return Boolean(ownerDocument.defaultView?.matchMedia?.(REDUCED_MOTION_QUERY).matches);
	}

	function warnInlineOnce(element, message) {
		if (warnedInlineElements.has(element)) return;
		warnedInlineElements.add(element);
		console.warn(message);
	}

	function stopInlineRecord(record) {
		if (!record?.player) return;

		if (record.ready || record.player.ready) {
			try {
				record.player.stop();
			} catch (error) {
				console.error("[videos] Inline player did not stop cleanly.", error);
			}
		} else if (record.player.config) {
			record.player.config.autoplay = false;
		}

		try {
			record.player.currentTime = 0;
		} catch {}

		if (record.media?.tagName === "VIDEO") {
			if (!record.media.paused) record.media.pause?.();
			try {
				record.media.currentTime = 0;
			} catch {}
		}
	}

	function destroyInlinePlayer(record) {
		if (!record?.player) return;
		try {
			record.player.stop();
		} catch (error) {
			console.error("[videos] Inline player did not stop cleanly.", error);
		}
		try {
			record.player.destroy();
		} catch (error) {
			console.error("[videos] Inline player did not destroy cleanly.", error);
		}
	}

	function disposeInlineRecord(record) {
		if (!record || record.disposed) return;
		record.disposed = true;
		record.active = false;
		clearTimeout(record.timer);
		if (record.ready || record.player.ready) destroyInlinePlayer(record);
		else if (record.player.config) record.player.config.autoplay = false;
		record.mount.replaceChildren();
		inlineByWrapper.delete(record.wrapper);
		inlineRecords.delete(record);
	}

	function playInlineRecord(record) {
		if (
			!record?.player ||
			record.disposed ||
			record.failed ||
			!record.active ||
			!record.autoplay ||
			!record.ready ||
			prefersReducedMotion()
		)
			return;

		record.media.muted = record.muted;
		try {
			record.player.muted = record.muted;
		} catch {}

		try {
			const result = record.player.play();
			result?.catch(() => {
				if (record.playWarningIssued) return;
				record.playWarningIssued = true;
				console.warn(
					"[videos] Inline autoplay was blocked; use muted video or player controls to start it.",
				);
			});
		} catch (error) {
			if (record.playWarningIssued) return;
			record.playWarningIssued = true;
			console.warn("[videos] Inline autoplay was blocked; use player controls to start it.", error);
		}
	}

	function watchInlinePlayer(record) {
		if (record.ready) return;

		record.timer = setTimeout(() => {
			if (record.disposed || record.ready || record.failed) return;
			record.failed = true;
			console.error("[videos] Inline video provider did not become ready in time.");
			if (record.player.config) record.player.config.autoplay = false;
		}, readyTimeout);

		record.player.once("ready", () => {
			clearTimeout(record.timer);
			record.ready = true;
			if (record.disposed) {
				destroyInlinePlayer(record);
				return;
			}
			if (record.active && record.autoplay && !prefersReducedMotion()) playInlineRecord(record);
			else stopInlineRecord(record);
		});
		record.player.once("error", () => {
			if (record.disposed || record.failed) return;
			record.failed = true;
			console.error("[videos] Inline video provider reported an error.");
			stopInlineRecord(record);
		});
	}

	function createInlineRecord(stack, wrapper) {
		const existingRecord = inlineByWrapper.get(wrapper);
		if (existingRecord) return existingRecord;

		const template = [...wrapper.querySelectorAll(SOURCE_SELECTOR)].find(
			(element) => element.closest(INLINE_SELECTOR) === wrapper,
		);
		const mount = [...wrapper.querySelectorAll(MOUNT_SELECTOR)].find(
			(element) => element.closest(INLINE_SELECTOR) === wrapper,
		);
		if (!template || !mount) {
			warnInlineOnce(
				wrapper,
				"[videos] Skipped an inline video because it needs a template and [data-video-mount].",
			);
			return null;
		}

		const fragment = template.content.cloneNode(true);
		const media = getMedia(fragment);
		if (!media) {
			warnInlineOnce(
				wrapper,
				"[videos] The inline video source template does not contain one valid player.",
			);
			return null;
		}

		const record = {
			stack,
			wrapper,
			template,
			mount,
			media,
			player: null,
			autoplay: parseBooleanAttribute(template, "data-video-autoplay"),
			loop: parseBooleanAttribute(template, "data-video-loop"),
			muted: parseBooleanAttribute(template, "data-video-muted"),
			ready: false,
			active: null,
			disposed: false,
			failed: false,
			timer: null,
			playWarningIssued: false,
		};

		if (media.tagName === "VIDEO") {
			media.preload = "auto";
			media.autoplay = false;
			media.muted = record.muted;
			media.loop = record.loop;
		}
		mount.replaceChildren(fragment);

		try {
			record.player = new PlyrConstructor(media, {
				autoplay: false,
				loop: { active: record.loop },
				muted: record.muted,
				ratio: "16:9",
			});
		} catch (error) {
			console.error("[videos] Inline player did not start.", error);
			mount.replaceChildren();
			record.failed = true;
			return null;
		}

		record.ready = Boolean(record.player.ready);
		inlineByWrapper.set(wrapper, record);
		inlineRecords.add(record);
		if (record.ready) {
			if (!record.autoplay) stopInlineRecord(record);
		} else {
			watchInlinePlayer(record);
		}
		return record;
	}

	function getStackState(component) {
		const generatedSources = getOwnedMatches(
			component,
			'[data-panel-stack-generated="source"]',
			PANEL_STACK_SELECTOR,
		);
		const sources = generatedSources.length
			? generatedSources
			: getOwnedMatches(component, "[data-panel-stack-source]", PANEL_STACK_SELECTOR);
		const activeSource =
			(generatedSources.length
				? generatedSources.find((source) => source.classList.contains("is-active"))
				: sources.find((source) => source.closest("[data-panel-stack-item]")?.classList.contains("is-open"))) ??
			sources[0] ??
			null;
		return {
			mode: generatedSources.length ? "desktop" : "mobile",
			sources,
			activeSource,
			previousSource: null,
		};
	}

	function getInlineWrappers(source) {
		return getMatchingTree(source, INLINE_SELECTOR).filter(
			(wrapper) => wrapper.closest("[data-panel-stack-source]") === source,
		);
	}

	function reconcileInlineStack(stack, state) {
		const sources = Array.isArray(state?.sources) ? state.sources : [];
		const desiredWrappers = new Set(sources.flatMap(getInlineWrappers));
		[...inlineRecords]
			.filter((record) => record.stack === stack && !desiredWrappers.has(record.wrapper))
			.forEach(disposeInlineRecord);

		const records = sources.flatMap((source) => {
			const sourceRecord = getInlineWrappers(source).map((wrapper) =>
				createInlineRecord(stack, wrapper),
			);
			return sourceRecord.filter(Boolean).map((record) => ({ record, source }));
		});
		const activeSource = state?.activeSource ?? null;
		records.forEach(({ record, source }) => {
			const isActive = source === activeSource;
			if (record.active === isActive) return;
			record.active = isActive;
			if (isActive) {
				if (record.ready) {
					if (record.autoplay && !prefersReducedMotion()) playInlineRecord(record);
					else stopInlineRecord(record);
				}
			} else stopInlineRecord(record);
		});
	}

	function handlePanelStackStateChange(event) {
		const stack = event.target.closest?.(PANEL_STACK_SELECTOR);
		if (stack) reconcileInlineStack(stack, event.detail);
	}

	function scanPanelStacks() {
		getMatchingTree(root, PANEL_STACK_SELECTOR).forEach((stack) => {
			reconcileInlineStack(stack, getStackState(stack));
		});
	}

	function discardDisconnectedInlinePlayers() {
		[...inlineRecords]
			.filter((record) => !record.wrapper.isConnected || !root.contains?.(record.wrapper))
			.forEach(disposeInlineRecord);
	}

	function handleClick(event) {
		const closeButton = event.target.closest?.(CLOSE_SELECTOR);
		if (closeButton) {
			const dialog = closeButton.closest(DIALOG_SELECTOR);
			if (dialog) closeDialog(dialog);
			return;
		}

		const trigger = event.target.closest?.(OPEN_SELECTOR);
		if (!trigger) return;

		const source = trigger.closest(COMPONENT_SELECTOR)?.querySelector(SOURCE_SELECTOR);
		const dialog = ownerDocument.querySelector(DIALOG_SELECTOR);
		const mount = dialog?.querySelector(MOUNT_SELECTOR);
		if (!source || !dialog || !mount) {
			console.warn("[videos] The video component or shared dialog markup is incomplete.");
			return;
		}

		const fragment = source.content.cloneNode(true);
		const media = getMedia(fragment);
		if (!media) {
			console.warn("[videos] The video source template does not contain one valid player.");
			return;
		}

		mount.replaceChildren(fragment);
		openDialog(dialog, trigger);
		try {
			activePlayer = new PlyrConstructor(media, { autoplay: true, ratio: "16:9" });
			watchPlayer(activePlayer, dialog);
			activePlayer.play()?.catch(() => {});
		} catch (error) {
			console.error("[videos] Player did not start.", error);
			closeDialog(dialog, "error");
		}
	}

	function handleClose(event) {
		if (event.target.matches?.(DIALOG_SELECTOR)) clearPlayer(event.target);
	}

	root.addEventListener("click", handleClick);
	root.addEventListener("close", handleClose, true);
	root.addEventListener(PANEL_STACK_STATE_EVENT, handlePanelStackStateChange);
	const observationRoot = root.nodeType === 9 ? root.documentElement : root;
	const Observer = ownerDocument.defaultView?.MutationObserver;
	const observer = Observer
		? new Observer(discardDisconnectedInlinePlayers)
		: null;
	observer?.observe(observationRoot, { childList: true, subtree: true });
	scanPanelStacks();

	const cleanup = () => {
		root.removeEventListener("click", handleClick);
		root.removeEventListener("close", handleClose, true);
		root.removeEventListener(PANEL_STACK_STATE_EVENT, handlePanelStackStateChange);
		observer?.disconnect();
		[...inlineRecords].forEach(disposeInlineRecord);
		clearPlayer();
		initializedRoots.delete(root);
	};

	initializedRoots.set(root, cleanup);
	return cleanup;
}
