import Splide from "@splidejs/splide";

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

			return new SplideConstructor(element, options).mount();
		});

	return () => instances.forEach((instance) => instance.destroy());
}
