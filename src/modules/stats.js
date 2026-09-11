const COMPONENT_SELECTOR = '[data-stats="component"]';
const VALUE_SELECTOR = '[data-stats="value"]';
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const DURATION = 1;
const STAT_DELAY = 0.0;
const MAX_WIDTH_STEPS = 10000;

const initializedRoots = new WeakMap();
const warnedValues = new WeakSet();

function getMatchingTree(root, selector) {
	return [
		...(root.matches?.(selector) ? [root] : []),
		...(root.querySelectorAll?.(selector) ?? []),
	];
}

function getOwnedValues(component) {
	return [...component.querySelectorAll(VALUE_SELECTOR)].filter(
		(value) => value.closest(COMPONENT_SELECTOR) === component,
	);
}

function decimalPlaces(value) {
	const [, fraction = ""] = String(value).split(".");
	return fraction.length;
}

function formatValue(value, precision) {
	return precision ? value.toFixed(precision) : String(Math.round(value));
}

function measureWidestValue(element, start, end, increment, precision) {
	const measurer = element.cloneNode(false);
	measurer.removeAttribute("id");
	measurer.removeAttribute("data-stats");
	measurer.setAttribute("aria-hidden", "true");
	Object.assign(measurer.style, {
		position: "fixed",
		left: "-10000px",
		top: "0",
		display: "inline-block",
		width: "max-content",
		minWidth: "0",
		maxWidth: "none",
		visibility: "hidden",
		whiteSpace: "nowrap",
		pointerEvents: "none",
	});
	element.after(measurer);

	const stepCount = Math.ceil((end - start) / increment);
	let widest = 0;
	if (stepCount <= MAX_WIDTH_STEPS) {
		for (let index = 0; index <= stepCount; index += 1) {
			const current = Math.min(start + index * increment, end);
			measurer.textContent = formatValue(current, precision);
			widest = Math.max(widest, measurer.getBoundingClientRect().width);
		}
	} else {
		for (const current of [start, end]) {
			measurer.textContent = formatValue(current, precision);
			widest = Math.max(widest, measurer.getBoundingClientRect().width);
		}

		let widestDigit = "0";
		let widestDigitWidth = 0;
		for (let digit = 0; digit <= 9; digit += 1) {
			measurer.textContent = String(digit);
			const digitWidth = measurer.getBoundingClientRect().width;
			if (digitWidth > widestDigitWidth) {
				widestDigit = String(digit);
				widestDigitWidth = digitWidth;
			}
		}
		const largestMagnitude = Math.max(Math.abs(start), Math.abs(end));
		const integerDigits = Math.max(1, Math.floor(Math.log10(largestMagnitude || 1)) + 1);
		const sign = start < 0 ? "-" : "";
		const fraction = precision ? `.${widestDigit.repeat(precision)}` : "";
		measurer.textContent = `${sign}${widestDigit.repeat(integerDigits)}${fraction}`;
		widest = Math.max(widest, measurer.getBoundingClientRect().width);
	}

	measurer.remove();
	return Math.ceil(widest);
}

function readValueRecord(element) {
	const finalText = element.textContent.trim();
	const start = Number(element.dataset.start);
	const end = Number(finalText);
	const increment = Number(element.dataset.increment);
	if (
		!Number.isFinite(start) ||
		!Number.isFinite(end) ||
		!Number.isFinite(increment) ||
		increment <= 0 ||
		start > end
	) {
		if (!warnedValues.has(element)) {
			warnedValues.add(element);
			console.warn(
				"[stats] Skipped a value because it needs a numeric final value, a numeric data-start, and a positive data-increment.",
			);
		}
		return null;
	}

	return {
		element,
		start,
		end,
		increment,
		finalText,
		precision: Math.max(decimalPlaces(start), decimalPlaces(end), decimalPlaces(increment)),
		originalStyles: {
			display: element.style.display,
			textAlign: element.style.textAlign,
			width: element.style.width,
			boxSizing: element.style.boxSizing,
			whiteSpace: element.style.whiteSpace,
		},
	};
}

function reserveValueWidth(record) {
	const width = measureWidestValue(
		record.element,
		record.start,
		record.end,
		record.increment,
		record.precision,
	);
	Object.assign(record.element.style, {
		display: "inline-block",
		textAlign: "center",
		width: `${width}px`,
		boxSizing: "border-box",
		whiteSpace: "nowrap",
	});
}

function restoreRecord(record) {
	record.element.textContent = record.finalText;
	Object.assign(record.element.style, record.originalStyles);
}

function createComponentTimeline(component, records, gsap) {
	const timeline = gsap.timeline({
		scrollTrigger: {
			trigger: component,
			start: "top 80%",
			once: true,
		},
	});

	records.forEach((record, index) => {
		timeline.from(
			record.element,
			{
				textContent: record.start,
				duration: DURATION,
				ease: "power2.out",
				snap: { textContent: record.increment },
				onUpdate() {
					const current = Number(record.element.textContent);
					if (Number.isFinite(current)) {
						record.element.textContent = formatValue(current, record.precision);
					}
				},
				onComplete() {
					record.element.textContent = record.finalText;
				},
			},
			index * STAT_DELAY,
		);
	});

	return timeline;
}

export function initStats(
	root = document,
	gsap = globalThis.gsap,
	ScrollTrigger = globalThis.ScrollTrigger,
) {
	const existingCleanup = initializedRoots.get(root);
	if (existingCleanup) return existingCleanup;

	if (!gsap?.registerPlugin || !gsap?.timeline || !ScrollTrigger) {
		console.warn("[stats] GSAP and ScrollTrigger are required to initialize Stats.");
		return () => {};
	}

	gsap.registerPlugin(ScrollTrigger);
	const timelines = [];
	const records = [];
	let active = true;

	const setup = () => {
		if (!active) return;
		const reduceMotion = globalThis.matchMedia?.(REDUCED_MOTION_QUERY)?.matches;
		for (const component of getMatchingTree(root, COMPONENT_SELECTOR)) {
			const componentRecords = getOwnedValues(component).map(readValueRecord).filter(Boolean);
			if (!componentRecords.length || reduceMotion) continue;
			componentRecords.forEach(reserveValueWidth);
			records.push(...componentRecords);
			timelines.push(createComponentTimeline(component, componentRecords, gsap));
		}
		ScrollTrigger.refresh?.();
	};

	const ownerDocument = root.nodeType === 9 ? root : root.ownerDocument;
	const fontsReady = ownerDocument?.fonts?.ready;
	if (fontsReady?.then) fontsReady.then(setup);
	else setup();

	const cleanup = () => {
		if (!active) return;
		active = false;
		for (const timeline of timelines) {
			timeline.scrollTrigger?.kill?.();
			timeline.kill?.();
		}
		records.forEach(restoreRecord);
		initializedRoots.delete(root);
	};

	initializedRoots.set(root, cleanup);
	return cleanup;
}
