import Splide from "@splidejs/splide";

const MAIN_OPTIONS = {
	type: "fade",
	rewind: true,
	rewindByDrag: true,
	speed: 700,
	easing: "cubic-bezier(0.45, 0, 0.2, 1)",
	interval: 8000,
	pagination: false,
	pauseOnHover: true,
	pauseOnFocus: false,
	resetProgress: true,
	waitForTransition: false,
	keyboard: "focused",
	live: true,
	reducedMotion: {
		speed: 0,
		rewindSpeed: 0,
		autoplay: "pause",
	},
};

const NAV_OPTIONS = {
	type: "loop",
	fixedWidth: "3rem",
	gap: "0rem",
	focus: "center",
	perMove: 1,
	perPage: 3,
	arrows: false,
	pagination: false,
	isNavigation: true,
	updateOnMove: true,
	trimSpace: false,
	speed: 450,
	easing: "cubic-bezier(0.65, 0, 0.35, 1)",
};

function directChildWithClass(element, className) {
	return [...(element?.children || [])].find((child) => child.classList.contains(className));
}

function prepareStructure(component) {
	const stack = component.querySelector(".testimonials_stack");
	const mainTrack =
		directChildWithClass(stack, "splide__track") || directChildWithClass(stack, "w-dyn-list");
	const mainList =
		directChildWithClass(mainTrack, "splide__list") ||
		directChildWithClass(mainTrack, "w-dyn-items");
	const mainSlides = [...(mainList?.children || [])].filter(
		(child) => child.classList.contains("splide__slide") || child.classList.contains("w-dyn-item"),
	);

	const navRoot = component.querySelector('[data-testimonials="nav"]');
	const navTrack =
		navRoot?.querySelector(":scope > .splide__track") ||
		navRoot?.querySelector(":scope > .w-dyn-list");
	const navList =
		directChildWithClass(navTrack, "splide__list") || directChildWithClass(navTrack, "w-dyn-items");
	const navSlides = [...(navList?.children || [])].filter(
		(child) => child.classList.contains("splide__slide") || child.classList.contains("w-dyn-item"),
	);

	if (!stack || !mainTrack || !mainList || !mainSlides.length) return null;

	stack.classList.add("splide");
	stack.setAttribute("data-splide-custom", "");
	mainTrack.classList.add("splide__track");
	mainList.classList.add("splide__list");
	mainSlides.forEach((slide) => slide.classList.add("splide__slide"));

	if (navRoot && navTrack && navList && navSlides.length === mainSlides.length) {
		navRoot.classList.add("splide");
		navRoot.setAttribute("data-splide-custom", "");
		navTrack.classList.add("splide__track");
		navList.classList.add("splide__list");
		navSlides.forEach((slide) => {
			slide.classList.remove("is-active");
			slide.classList.add("splide__slide");
		});
	} else {
		navRoot?.setAttribute("hidden", "");
	}

	return {
		mainRoot: stack,
		mainTrack,
		mainList,
		mainSlides,
		navRoot,
		navTrack,
		navList,
		navSlides: navSlides.length === mainSlides.length ? navSlides : [],
	};
}

function formatIndex(index, total) {
	const width = Math.max(2, String(total).length);
	return `${String(index + 1).padStart(width, "0")} / ${String(total).padStart(width, "0")}`;
}

function updateIndex(component, index, total) {
	const label = formatIndex(index, total);
	component.querySelectorAll(".testimonials_index").forEach((element) => {
		element.textContent = label;
	});
}

function createMotion(component, slides, gsap) {
	const progress = component.querySelector('[data-testimonials="progress"]');
	const images = slides.map((slide) => slide.querySelector('[data-testimonials="image"]'));
	const copies = slides.map((slide) => slide.querySelector('[data-testimonials="copy"]'));
	const imageTweens = new Map();
	const reduceMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false;

	function setProgress(rate) {
		if (progress) gsap.set(progress, { scaleX: rate, transformOrigin: "left center" });
	}

	function animateCopy(index) {
		const copy = copies[index];
		if (!copy) return;
		gsap.killTweensOf(copy);
		if (reduceMotion) {
			gsap.set(copy, { autoAlpha: 1, y: 0 });
			return;
		}
		gsap.fromTo(
			copy,
			{ autoAlpha: 0, y: 20 },
			{ autoAlpha: 1, y: 0, duration: 0.6, ease: "power2.out", overwrite: "auto" },
		);
	}

	function startImage(index) {
		const image = images[index];
		if (!image) return;
		imageTweens.get(image)?.kill();
		gsap.killTweensOf(image);
		if (reduceMotion) {
			gsap.set(image, { clearProps: "transform" });
			return;
		}

		const horizontalStart = index % 2 === 0 ? -1.5 : 1.5;
		const verticalStart = index % 3 === 0 ? -1 : 1;
		const tween = gsap.fromTo(
			image,
			{ scale: 1.04, xPercent: horizontalStart, yPercent: verticalStart },
			{
				scale: 1.14,
				xPercent: -horizontalStart,
				yPercent: -verticalStart,
				duration: 14,
				ease: "none",
				overwrite: "auto",
			},
		);
		imageTweens.set(image, tween);
	}

	function stopImage(index) {
		const image = images[index];
		if (!image) return;
		imageTweens.get(image)?.kill();
		imageTweens.delete(image);
		gsap.killTweensOf(image);
	}

	function pause(index) {
		const tween = imageTweens.get(images[index]);
		tween?.pause();
	}

	function resume(index) {
		const tween = imageTweens.get(images[index]);
		tween?.resume();
	}

	function destroy() {
		imageTweens.forEach((tween) => tween.kill());
		imageTweens.clear();
		gsap.killTweensOf(
			[...images.filter(Boolean), ...copies.filter(Boolean), progress].filter(Boolean),
		);
	}

	return { animateCopy, destroy, pause, resume, setProgress, startImage, stopImage };
}

function initComponent(component, SplideConstructor, gsap) {
	if (component.hasAttribute("data-testimonials-mounted")) return () => {};
	const structure = prepareStructure(component);
	if (!structure) return () => {};

	component.setAttribute("data-testimonials-mounted", "");
	const { mainRoot, mainSlides, navRoot, navSlides } = structure;
	const count = mainSlides.length;
	const hasMultiple = count > 1;
	const progress = component.querySelector('[data-testimonials="progress"]');
	const progressWrap = progress?.parentElement;
	const arrows = component.querySelector(".splide__arrows");
	const motion = createMotion(component, mainSlides, gsap);
	let activeIndex = 0;

	if (!hasMultiple) {
		navRoot?.setAttribute("hidden", "");
		arrows?.setAttribute("hidden", "");
		progressWrap?.setAttribute("hidden", "");
	}

	const main = new SplideConstructor(mainRoot, {
		...MAIN_OPTIONS,
		arrows: hasMultiple,
		drag: hasMultiple,
		autoplay: hasMultiple,
	});
	const nav =
		hasMultiple && navRoot && navSlides.length
			? new SplideConstructor(navRoot, {
					...NAV_OPTIONS,
					type: count > 3 ? "loop" : "slide",
					drag: count > 3,
				})
			: null;

	main.on("mounted", () => {
		updateIndex(component, activeIndex, count);
		motion.setProgress(0);
		motion.animateCopy(activeIndex);
		motion.startImage(activeIndex);
	});
	main.on("move", (index) => {
		activeIndex = index;
		updateIndex(component, index, count);
		motion.setProgress(0);
		motion.animateCopy(index);
		motion.startImage(index);
	});
	main.on("moved", (_index, previous) => {
		if (previous !== activeIndex) motion.stopImage(previous);
	});
	main.on("autoplay:playing", (rate) => motion.setProgress(rate));
	main.on("autoplay:pause", () => motion.pause(activeIndex));
	main.on("autoplay:play", () => motion.resume(activeIndex));

	if (nav) main.sync(nav);
	main.mount();
	nav?.mount();

	return () => {
		nav?.destroy();
		main.destroy();
		motion.destroy();
		component.removeAttribute("data-testimonials-mounted");
	};
}

export function initTestimonials(
	root = document,
	SplideConstructor = Splide,
	gsap = globalThis.gsap,
) {
	if (!gsap?.set || !gsap?.fromTo || !gsap?.killTweensOf) return () => {};
	const cleanups = [...root.querySelectorAll('[data-testimonials="root"]')].map((component) =>
		initComponent(component, SplideConstructor, gsap),
	);
	return () => cleanups.forEach((cleanup) => cleanup());
}
