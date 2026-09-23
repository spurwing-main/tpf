const OVERLAY_SELECTOR = "[data-intro-overlay]";
const ACTIVE_CLASS = "tpf-intro-active";
const REVEAL_EVENT = "tpf:intro:reveal";
const REVEAL_READY_ATTRIBUTE = "data-intro-reveal-ready";
const REVEAL_PROGRESS = 0.65;
const MAX_WAIT = 2500;
const DURATION = 0.9;

const initializedOverlays = new WeakMap();

function findOverlay(root) {
	if (root.matches?.(OVERLAY_SELECTOR)) return root;
	return root.querySelector?.(OVERLAY_SELECTOR) ?? null;
}

export function initIntroOverlay(root = document) {
	const overlay = findOverlay(root);
	if (!overlay) return () => {};

	const existingCleanup = initializedOverlays.get(overlay);
	if (existingCleanup) return existingCleanup;

	const ownerDocument = overlay.ownerDocument;
	const ownerWindow = ownerDocument.defaultView || globalThis;
	const gsap = ownerWindow.gsap;
	const rootElement = ownerDocument.documentElement;
	const hadActiveClass = rootElement.classList.contains(ACTIVE_CLASS);
	let active = true;
	let timeline = null;
	let timeoutId = null;
	let firstFrame = null;
	let secondFrame = null;
	let revealDispatched = false;
	const dispatchReveal = () => {
		if (revealDispatched) return;
		revealDispatched = true;
		rootElement.setAttribute(REVEAL_READY_ATTRIBUTE, "");
		const EventConstructor = ownerWindow.CustomEvent || globalThis.CustomEvent;
		if (EventConstructor) {
			rootElement.dispatchEvent(new EventConstructor(REVEAL_EVENT));
		}
	};

	overlay.removeAttribute("data-intro-dismissed");
	rootElement.removeAttribute(REVEAL_READY_ATTRIBUTE);
	rootElement.classList.add(ACTIVE_CLASS);

	const release = () => {
		if (!active) return;
		active = false;
		ownerWindow.clearTimeout(timeoutId);
		if (firstFrame !== null) ownerWindow.cancelAnimationFrame(firstFrame);
		if (secondFrame !== null) ownerWindow.cancelAnimationFrame(secondFrame);
		overlay.setAttribute("data-intro-dismissed", "");
		dispatchReveal();
		if (!hadActiveClass) rootElement.classList.remove(ACTIVE_CLASS);
		initializedOverlays.delete(overlay);
	};

	const onLoad = () => {
		firstFrame = ownerWindow.requestAnimationFrame(() => {
			secondFrame = ownerWindow.requestAnimationFrame(() => {
				if (!active) return;
				if (ownerWindow.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
					release();
					return;
				}
				if (!gsap?.timeline) {
					release();
					return;
				}

				timeline = gsap.timeline({ onComplete: release });
				timeline.to(overlay, {
					yPercent: -100,
					duration: DURATION,
					ease: "power3.inOut",
					onUpdate: () => {
						if (timeline.progress() >= REVEAL_PROGRESS) dispatchReveal();
					},
				});
			});
		});
	};

	const cleanup = () => {
		if (!active) return;
		ownerWindow.removeEventListener("load", onLoad);
		timeline?.kill?.();
		release();
	};

	ownerWindow.addEventListener("load", onLoad, { once: true });
	timeoutId = ownerWindow.setTimeout(() => {
		timeline?.kill?.();
		release();
	}, MAX_WAIT);
	initializedOverlays.set(overlay, cleanup);

	if (ownerDocument.readyState === "complete") onLoad();
	return cleanup;
}
