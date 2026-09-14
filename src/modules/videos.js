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
const initializedRoots = new WeakMap();

function getOwnerDocument(root) {
	return root.nodeType === 9 ? root : root.ownerDocument;
}

function hasTextAttribute(element, name) {
	return Boolean(element.getAttribute(name)?.trim());
}

function getMedia(fragment) {
	if (fragment.children.length !== 1) return null;

	const media = fragment.firstElementChild;
	if (media.tagName === "VIDEO") {
		const hasSource = hasTextAttribute(media, "src") ||
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
			activePlayer = new PlyrConstructor(media, { autoplay: true });
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

	const cleanup = () => {
		root.removeEventListener("click", handleClick);
		root.removeEventListener("close", handleClose, true);
		clearPlayer();
		initializedRoots.delete(root);
	};

	initializedRoots.set(root, cleanup);
	return cleanup;
}
