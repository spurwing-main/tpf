import Splide from "@splidejs/splide";
import { AutoScroll } from "@splidejs/splide-extension-auto-scroll";

const OPTIONS = {
	type: "slide",
	autoWidth: true,
	arrows: false,
	pagination: false,
	drag: true,
	snap: true,
	rewind: false,
	trimSpace: true,
	mediaQuery: "max",
};

function isEnabled(element, attribute) {
	return element.getAttribute(attribute) === "true";
}

function getNumber(element, attribute, fallback) {
	const rawValue = element.getAttribute(attribute);
	if (rawValue === null) return fallback;

	const value = Number(rawValue);
	return Number.isFinite(value) ? value : fallback;
}

function getBoolean(element, attribute, fallback) {
	const value = element.getAttribute(attribute);
	return value === null ? fallback : isEnabled(element, attribute);
}

function hasRequiredMarkup(element) {
	const track = element.querySelector(".splide__track");
	return Boolean(
		track && [...track.children].some((child) => child.classList.contains("splide__list")),
	);
}

export function initSliders(root = document, SplideConstructor = Splide) {
	const instances = [
		...root.querySelectorAll(".splide:not([data-splide-custom]):not([data-testimonials])"),
	] // exclude custom component splides
		.filter(hasRequiredMarkup)
		.map((element) => {
			const options = {
				...OPTIONS,
				type: isEnabled(element, "data-splide-loop") ? "loop" : "slide",
				arrows: isEnabled(element, "data-splide-arrows"),
				pagination: isEnabled(element, "data-splide-pagination"),
			};
			const autoscroll = isEnabled(element, "data-splide-autoscroll");

			if (autoscroll) {
				options.autoScroll = {
					speed: getNumber(element, "data-splide-autoscroll-speed", 1),
					pauseOnHover: getBoolean(element, "data-splide-autoscroll-pause-on-hover", true),
					pauseOnFocus: getBoolean(element, "data-splide-autoscroll-pause-on-focus", true),
				};
			}

			const instance = new SplideConstructor(element, options);
			return autoscroll ? instance.mount({ AutoScroll }) : instance.mount();
		});

	return () => instances.forEach((instance) => instance.destroy());
}
