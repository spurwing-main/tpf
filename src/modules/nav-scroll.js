const SCROLL_THRESHOLD = 48;
const SCROLL_UP_DISTANCE = 24;
const SCROLLED_CLASS = "is-scrolled";

function getScrollY(ownerWindow) {
	return Math.max(0, Number(ownerWindow.scrollY) || 0);
}

function initTarget(root) {
	const ownerDocument = root.nodeType === 9 ? root : root.ownerDocument;
	const ownerWindow = ownerDocument.defaultView || globalThis;
	const threshold = SCROLL_THRESHOLD;
	const upDistance = SCROLL_UP_DISTANCE;
	const className = SCROLLED_CLASS;
	const target = ownerDocument.documentElement;
	const initialHasClass = target.classList.contains(className);
	let lastScroll = getScrollY(ownerWindow);
	let upwardStart = null;

	function update(nextScroll) {
		const scroll = Math.max(
			0,
			Number(typeof nextScroll === "number" ? nextScroll : getScrollY(ownerWindow)) || 0,
		);

		if (scroll <= threshold) {
			upwardStart = null;
			target.classList.remove(className);
		} else if (scroll > lastScroll) {
			upwardStart = null;
			target.classList.add(className);
		} else if (scroll < lastScroll) {
			if (upwardStart === null) upwardStart = lastScroll;
			if (upwardStart - scroll >= upDistance) target.classList.remove(className);
		}

		lastScroll = scroll;
	}

	target.classList.toggle(className, lastScroll > threshold);
	update();

	let destroyScrollTracking;
	if (ownerWindow.gsap && ownerWindow.ScrollTrigger) {
		ownerWindow.gsap.registerPlugin?.(ownerWindow.ScrollTrigger);
		const trigger = ownerWindow.ScrollTrigger.create({
			start: 0,
			end: () => ownerWindow.ScrollTrigger.maxScroll(ownerWindow),
			onUpdate: (self) => update(self.scroll()),
		});
		destroyScrollTracking = () => trigger.kill();
	} else {
		ownerWindow.addEventListener("scroll", update, { passive: true });
		destroyScrollTracking = () => ownerWindow.removeEventListener("scroll", update);
	}

	return () => {
		destroyScrollTracking();
		target.classList.toggle(className, initialHasClass);
	};
}

export function initNavScrollState(root = document) {
	return initTarget(root);
}
