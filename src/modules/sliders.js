import Splide, {
	CLASS_INITIALIZED,
	CLASS_PAGINATION,
	STATUS_CLASSES,
} from "@splidejs/splide";
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
const MOBILE_QUERY = "(max-width: 767px)";

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

function getSlideList(element) {
	const track = element.querySelector(".splide__track");
	return [...(track?.children ?? [])].find((child) => child.classList.contains("splide__list"));
}

function getSlideCount(element) {
	const list = getSlideList(element);
	return [...(list?.children ?? [])].filter((child) => child.classList.contains("splide__slide"))
		.length;
}

function getSlideMinimum(element) {
	const rawValue = element.getAttribute("data-splide-slide-min");
	if (rawValue === null || rawValue.trim() === "") return null;

	const value = Number(rawValue);
	return Number.isInteger(value) && value > 0 ? value : null;
}

function hasRequiredMarkup(element) {
	return Boolean(getSlideList(element));
}

function getPaginationWrapper(element) {
	return [...element.querySelectorAll("ul[data-splide-pagination-wrapper]")].find(
		(wrapper) => wrapper.closest(".splide") === element,
	);
}

function preparePaginationWrapper(element, enabled) {
	if (!enabled) return { paginationWrapper: null, paginationClassAdded: false };

	const paginationWrapper = getPaginationWrapper(element) ?? null;
	const paginationClassAdded = Boolean(
		paginationWrapper && !paginationWrapper.classList.contains(CLASS_PAGINATION),
	);

	paginationWrapper?.classList.add(CLASS_PAGINATION);
	return { paginationWrapper, paginationClassAdded };
}

function createOptions(element) {
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

	return { options, autoscroll };
}

function destroy(record) {
	if (record.instance) {
		record.instance.destroy(true);
		record.instance = null;
	}

	record.element.classList.remove(CLASS_INITIALIZED, ...STATUS_CLASSES);
}

function mount(record) {
	if (record.instance) return;

	const instance = new record.SplideConstructor(record.element, record.options);
	record.instance = record.autoscroll ? instance.mount({ AutoScroll }) : instance.mount();
}

function reconcile(record, isMobile) {
	const shouldMount = record.mobileOnly
		? isMobile
		: record.minimum === null || isMobile || getSlideCount(record.element) >= record.minimum;

	if (shouldMount) {
		mount(record);
		return;
	}

	destroy(record);
}

export function initSliders(root = document, SplideConstructor = Splide) {
	const records = [
		...root.querySelectorAll(".splide:not([data-splide-custom]):not([data-testimonials])"),
	] // exclude custom component splides
		.filter(hasRequiredMarkup)
		.map((element) => {
			const { options, autoscroll } = createOptions(element);
			const { paginationWrapper, paginationClassAdded } = preparePaginationWrapper(
				element,
				options.pagination,
			);
			const minimum = getSlideMinimum(element);
			const mobileOnly = isEnabled(element, "data-splide-mobile-only");
			const needsMediaQuery = mobileOnly || minimum !== null;

			const mediaQuery = needsMediaQuery ? globalThis.matchMedia?.(MOBILE_QUERY) : null;
			const record = {
				element,
				paginationWrapper,
				paginationClassAdded,
				minimum,
				mobileOnly,
				options,
				autoscroll,
				SplideConstructor,
				mediaQuery,
				instance: null,
				onMediaChange: null,
			};

			record.onMediaChange = () => reconcile(record, record.mediaQuery.matches);
			record.mediaQuery?.addEventListener?.("change", record.onMediaChange);
			reconcile(record, record.mediaQuery?.matches ?? false);

			return record;
		});

	return () =>
		records.forEach((record) => {
			record.mediaQuery?.removeEventListener?.("change", record.onMediaChange);
			destroy(record);
			if (record.paginationClassAdded) {
				record.paginationWrapper.classList.remove(CLASS_PAGINATION);
			}
		});
}
