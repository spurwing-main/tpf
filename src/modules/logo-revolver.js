export const LOGO_REVOLVER_DEFAULTS = Object.freeze({
	mobileQuery: "(max-width: 767px)",
	reducedMotionQuery: "(prefers-reduced-motion: reduce)",
	mobileSlots: 2,
	stepMs: 5500,
	staggerMs: 400,
	transitionMs: 650,
});

export function partitionLogos(logos, requestedSlots) {
	const slotCount = Math.min(logos.length, Math.max(0, Math.floor(requestedSlots)));
	if (slotCount === 0) return [];

	const groups = Array.from({ length: slotCount }, () => []);
	logos.forEach((logo, index) => groups[index % slotCount].push(logo));
	return groups;
}

export function initLogoRevolver() {
	return () => {};
}
