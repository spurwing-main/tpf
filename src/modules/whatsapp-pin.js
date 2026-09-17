const PIN_SELECTOR = "[data-whatsapp-pin]";
const TRIGGER_SELECTOR = "[data-whatsapp-pin-trigger]";
const MOBILE_QUERY = "(max-width: 767px)";
const initializedRoots = new WeakMap();

function getPinElements(root) {
	if (!root?.querySelectorAll) return [];

	const elements = [...root.querySelectorAll(PIN_SELECTOR)];
	if (root.nodeType === 1 && root.matches(PIN_SELECTOR)) elements.unshift(root);
	return elements;
}

function getCleanup(root) {
	let cleaned = false;
	return () => {
		if (cleaned) return;
		cleaned = true;
		initializedRoots.delete(root);
	};
}

export function initWhatsappPin(
	root = document,
	gsap = globalThis.gsap,
	ScrollTrigger = globalThis.ScrollTrigger,
) {
	const existingCleanup = initializedRoots.get(root);
	if (existingCleanup) return existingCleanup;

	const pinElements = getPinElements(root);
	if (
		!pinElements.length ||
		typeof gsap?.matchMedia !== "function" ||
		typeof gsap?.registerPlugin !== "function" ||
		typeof ScrollTrigger?.create !== "function"
	) {
		const cleanup = getCleanup(root);
		initializedRoots.set(root, cleanup);
		return cleanup;
	}

	let warnedMissingTrigger = false;
	const records = pinElements.flatMap((pinElement) => {
		const triggerElement = pinElement.closest(TRIGGER_SELECTOR);
		if (!triggerElement) {
			if (!warnedMissingTrigger) {
				warnedMissingTrigger = true;
				console.warn(
					"[whatsapp-pin] Skipping pin wrappers without a nearest data-whatsapp-pin-trigger element.",
				);
			}
			return [];
		}

		return [{ pinElement, triggerElement }];
	});

	if (!records.length) {
		const cleanup = getCleanup(root);
		initializedRoots.set(root, cleanup);
		return cleanup;
	}

	gsap.registerPlugin(ScrollTrigger);
	const media = gsap.matchMedia();
	const activeTriggers = new Set();
	let cleaned = false;

	media.add(MOBILE_QUERY, () => {
		const triggers = records.map(({ pinElement, triggerElement }) => {
			const trigger = ScrollTrigger.create({
				trigger: triggerElement,
				start: "bottom bottom",
				end: "max",
				pin: pinElement,
				pinSpacing: false,
				invalidateOnRefresh: true,
			});
			activeTriggers.add(trigger);
			return trigger;
		});

		return () => {
			for (const trigger of triggers) {
				activeTriggers.delete(trigger);
				trigger?.kill?.();
			}
		};
	});

	const cleanup = () => {
		if (cleaned) return;
		cleaned = true;
		media.revert?.();

		for (const trigger of activeTriggers) trigger?.kill?.();
		activeTriggers.clear();
		initializedRoots.delete(root);
	};

	initializedRoots.set(root, cleanup);
	return cleanup;
}
