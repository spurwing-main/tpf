const MOBILE_QUERY = "(max-width: 767px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function restoreAttribute(element, name, value) {
	if (value === null) element.removeAttribute(name);
	else element.setAttribute(name, value);
}

function initNavElement(nav, gsap) {
	const openButton = nav.querySelector('.nav-btn[data-nav-btn="open"]');
	const closeButton = nav.querySelector('.nav-btn[data-nav-btn="close"]');
	const panel = nav.querySelector(".nav_center-item");
	const overlay = nav.querySelector(".nav_overlay");

	if (!openButton || !closeButton || !panel || !overlay) return null;

	const initialExpanded = openButton.getAttribute("aria-expanded");
	const initialHidden = panel.getAttribute("aria-hidden");
	const initialInert = panel.getAttribute("inert");
	const documentElement = nav.ownerDocument.documentElement;
	const links = [...panel.querySelectorAll("a[href]")];
	const media = gsap.matchMedia();

	media.add(MOBILE_QUERY, () => {
		const reduceMotion = globalThis.matchMedia?.(REDUCED_MOTION_QUERY).matches;
		const duration = reduceMotion ? 0 : 0.75;
		let isOpen = false;
		let previousOverflow = null;

		openButton.setAttribute("aria-expanded", "false");
		panel.setAttribute("aria-hidden", "true");
		panel.setAttribute("inert", "");

		const timeline = gsap.timeline({
			paused: true,
			defaults: { duration, ease: "power3.out", overwrite: "auto" },
		});

		timeline.to(panel, { x: 0, ease: "power3.out", easeReverse: "power1.out" }, 0);
		timeline.to(
			overlay,
			{ autoAlpha: 1, pointerEvents: "auto", ease: "power3.out", easeReverse: true },
			0,
		);

		function open() {
			if (isOpen) return;
			isOpen = true;
			previousOverflow = documentElement.style.overflow;
			documentElement.style.overflow = "hidden";
			openButton.setAttribute("aria-expanded", "true");
			panel.setAttribute("aria-hidden", "false");
			panel.removeAttribute("inert");
			gsap.set(panel, { pointerEvents: "auto" });
			timeline.play();
			// closeButton.focus();
		}

		function close({ restoreFocus = true } = {}) {
			if (!isOpen) return;
			isOpen = false;
			documentElement.style.overflow = previousOverflow;
			previousOverflow = null;
			openButton.setAttribute("aria-expanded", "false");
			panel.setAttribute("aria-hidden", "true");
			panel.setAttribute("inert", "");
			gsap.set(panel, { pointerEvents: "none" });
			timeline.reverse();
			// if (restoreFocus) openButton.focus();
		}

		function handleKeydown(event) {
			if (event.key === "Escape") close();
		}

		function handleLinkClick() {
			close({ restoreFocus: false });
		}

		openButton.addEventListener("click", open);
		closeButton.addEventListener("click", close);
		overlay.addEventListener("click", close);
		links.forEach((link) => link.addEventListener("click", handleLinkClick));
		nav.ownerDocument.addEventListener("keydown", handleKeydown);

		return () => {
			openButton.removeEventListener("click", open);
			closeButton.removeEventListener("click", close);
			overlay.removeEventListener("click", close);
			links.forEach((link) => link.removeEventListener("click", handleLinkClick));
			nav.ownerDocument.removeEventListener("keydown", handleKeydown);
			if (previousOverflow !== null) documentElement.style.overflow = previousOverflow;
			timeline.kill();
			gsap.set([panel, overlay], {
				clearProps: "transform,opacity,visibility,pointer-events",
			});
			restoreAttribute(openButton, "aria-expanded", initialExpanded);
			restoreAttribute(panel, "aria-hidden", initialHidden);
			restoreAttribute(panel, "inert", initialInert);
		};
	});

	return media;
}

export function initNav(root = document, gsap = globalThis.gsap) {
	if (!gsap?.set || !gsap?.timeline || !gsap?.matchMedia) return () => {};

	const mediaContexts = [...root.querySelectorAll(".nav")]
		.map((nav) => initNavElement(nav, gsap))
		.filter(Boolean);

	return () => mediaContexts.forEach((media) => media.revert());
}
