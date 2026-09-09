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
	breakpoints: {
		767: {
			pagination: true,
		},
	},
};

export function initCardSlider(root = document, SplideConstructor = Splide) {
	const instances = [...root.querySelectorAll(".explore_slider.splide")].map((element) =>
		new SplideConstructor(element, OPTIONS).mount(),
	);

	return () => instances.forEach((instance) => instance.destroy());
}
