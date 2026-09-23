const REVEAL_SELECTOR = "[data-reveal]";
const GROUP_SELECTOR = "[data-reveal-group]";
const INTRO_REVEAL_EVENT = "tpf:intro:reveal";
const INTRO_ACTIVE_CLASS = "tpf-intro-active";
const INTRO_REVEAL_READY_ATTRIBUTE = "data-intro-reveal-ready";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const ALLOW_MOTION_QUERY = "(prefers-reduced-motion: no-preference)";
const REVEAL_CLEAR_PROPS = "opacity,visibility,transform,clipPath";
const DURATION = 1.1;
const EASE = "power2.out";
const DEFAULT_STAGGER = 0.25;
const LOAD_DURATION = 1.1;
const LOAD_EASE = "power3.out";
const LOAD_STAGGER = 0.25;
const MEDIA_DURATION = 1.2;
const MEDIA_EASE = "power3.out";
const MAX_STAGGER = 2000;
const MAX_TOTAL_STAGGER = 4;
const MAX_DELAY = 400;

const START_POSITIONS = Object.freeze({
	early: "top 90%",
	default: "top 85%",
	late: "top 75%",
});

const PRESETS = Object.freeze({
	up: {
		from: { autoAlpha: 0, y: 28 },
		clearProps: "opacity,visibility,transform",
	},
	fade: {
		from: { autoAlpha: 0 },
		clearProps: "opacity,visibility",
	},
	media: {
		from: { clipPath: "inset(0 0 100% 0)", scale: 1.04, autoAlpha: 0 },
		to: { clipPath: "inset(0 0 0% 0)", scale: 1, autoAlpha: 1 },
		clearProps: "clipPath,transform,opacity,visibility",
		duration: MEDIA_DURATION,
		ease: MEDIA_EASE,
	},
});

const initializedRoots = new WeakMap();
const warnedElements = new WeakSet();

function getMatchingTree(root, selector) {
	return [
		...(root.matches?.(selector) ? [root] : []),
		...(root.querySelectorAll?.(selector) ?? []),
	];
}

function warnOnce(element, message) {
	if (warnedElements.has(element)) return;
	warnedElements.add(element);
	console.warn(`[reveals] ${message}`);
}

function readPreset(element) {
	const value = element.dataset.reveal || "up";
	if (PRESETS[value]) return PRESETS[value];
	warnOnce(element, `Unknown data-reveal="${value}"; using "up".`);
	return PRESETS.up;
}

function readBoundedNumber(element, attribute, fallback, maximum) {
	const value = element.getAttribute(attribute);
	if (value === null) return fallback;
	const number = Number(value);
	if (!Number.isFinite(number) || number < 0) {
		warnOnce(element, `Invalid ${attribute}="${value}"; using the default.`);
		return fallback;
	}
	if (number > maximum) {
		warnOnce(element, `${attribute} is capped at ${maximum}ms.`);
		return maximum / 1000;
	}
	return number / 1000;
}

function readStart(group) {
	const value = group.dataset.revealStart || "default";
	if (START_POSITIONS[value]) return START_POSITIONS[value];
	warnOnce(group, `Unknown data-reveal-start="${value}"; using "default".`);
	return START_POSITIONS.default;
}

function getGroupChildren(group) {
	return [...group.querySelectorAll(REVEAL_SELECTOR)].filter(
		(element) => element.closest(GROUP_SELECTOR) === group,
	);
}

function capGroupStagger(stagger, targetCount) {
	if (targetCount < 2) return 0;
	return Math.min(stagger, MAX_TOTAL_STAGGER / (targetCount - 1));
}

function animateTargets(
	targets,
	gsap,
	{ stagger = 0, delayFor = () => 0, duration = DURATION, ease = EASE } = {},
) {
	const timeline = gsap.timeline({ paused: true });
	targets.forEach((element, index) => {
		const preset = readPreset(element);
		const position = delayFor(element) + index * stagger;
		const variables = {
			duration: preset.duration ?? duration,
			ease: preset.ease ?? ease,
			clearProps: preset.clearProps,
		};
		if (preset.to) {
			timeline.fromTo(element, { ...preset.from }, { ...preset.to, ...variables }, position);
		} else {
			timeline.from(element, { ...preset.from, ...variables }, position);
		}
	});
	return timeline;
}

function clearRevealStyles(targets, gsap) {
	for (const target of new Set(targets)) {
		gsap.set(target, { clearProps: REVEAL_CLEAR_PROPS });
	}
}

function cleanupRecords(records, gsap) {
	const targets = [];
	for (const record of records) {
		record.cleanup?.();
		record.scrollTrigger?.kill?.();
		record.timeline?.kill?.();
		targets.push(...(record.targets ?? []));
	}
	clearRevealStyles(targets, gsap);
}

function initLoadTimeline(timeline, targets, ownerDocument) {
	const start = () => timeline.play();
	const root = ownerDocument.documentElement;
	if (
		root.classList.contains(INTRO_ACTIVE_CLASS) &&
		!root.hasAttribute(INTRO_REVEAL_READY_ATTRIBUTE)
	) {
		root.addEventListener(INTRO_REVEAL_EVENT, start, { once: true });
		return {
			timeline,
			targets,
			cleanup: () => root.removeEventListener(INTRO_REVEAL_EVENT, start),
		};
	}
	start();
	return { timeline, targets };
}

function initGroup(group, gsap, ScrollTrigger, ownerDocument, reducedMotion) {
	const targets = getGroupChildren(group);
	if (!targets.length || reducedMotion) return null;

	const trigger = group.dataset.revealTrigger || "scroll";
	const isLoadGroup = trigger === "load";
	const requestedStagger = readBoundedNumber(
		group,
		"data-reveal-stagger",
		isLoadGroup ? LOAD_STAGGER : DEFAULT_STAGGER,
		MAX_STAGGER,
	);
	const stagger = capGroupStagger(requestedStagger, targets.length);
	const delayFor = (element) => readBoundedNumber(element, "data-reveal-delay", 0, MAX_DELAY);
	const timeline = animateTargets(targets, gsap, {
		stagger,
		delayFor,
		duration: isLoadGroup ? LOAD_DURATION : DURATION,
		ease: isLoadGroup ? LOAD_EASE : EASE,
	});

	if (trigger === "load") {
		return initLoadTimeline(timeline, targets, ownerDocument);
	}
	if (trigger !== "scroll") {
		warnOnce(group, `Unknown data-reveal-trigger="${trigger}"; using "scroll".`);
	}

	if (!ScrollTrigger?.create) {
		timeline.play();
		return { timeline, targets };
	}

	const scrollTrigger = ScrollTrigger.create({
		trigger: group,
		start: readStart(group),
		once: true,
		onEnter: () => timeline.play(),
	});
	return { timeline, targets, scrollTrigger };
}

function initStandalone(element, gsap, ScrollTrigger, ownerDocument, reducedMotion) {
	if (element.closest(GROUP_SELECTOR) || reducedMotion) return null;
	const trigger = element.dataset.revealTrigger || "scroll";
	const isLoadReveal = trigger === "load";
	const timeline = animateTargets([element], gsap, {
		delayFor: (target) => readBoundedNumber(target, "data-reveal-delay", 0, MAX_DELAY),
		duration: isLoadReveal ? LOAD_DURATION : DURATION,
		ease: isLoadReveal ? LOAD_EASE : EASE,
	});
	if (isLoadReveal) {
		return initLoadTimeline(timeline, [element], ownerDocument);
	}
	if (trigger !== "scroll") {
		warnOnce(element, `Unknown data-reveal-trigger="${trigger}"; using "scroll".`);
	}
	if (!ScrollTrigger?.create) {
		timeline.play();
		return { timeline, targets: [element] };
	}
	const scrollTrigger = ScrollTrigger.create({
		trigger: element,
		start: readStart(element),
		once: true,
		onEnter: () => timeline.play(),
	});
	return { timeline, targets: [element], scrollTrigger };
}

export function initReveals(
	root = document,
	gsap = globalThis.gsap,
	ScrollTrigger = globalThis.ScrollTrigger,
) {
	const existingCleanup = initializedRoots.get(root);
	if (existingCleanup) return existingCleanup;

	const ownerDocument = root.nodeType === 9 ? root : root.ownerDocument;
	const ownerWindow = ownerDocument?.defaultView || globalThis;
	const targets = getMatchingTree(root, REVEAL_SELECTOR);
	if (!targets.length || !gsap?.timeline || !gsap?.set) {
		const cleanup = () => initializedRoots.delete(root);
		initializedRoots.set(root, cleanup);
		return cleanup;
	}

	if (ScrollTrigger) gsap.registerPlugin?.(ScrollTrigger);
	const setup = (reducedMotion) => {
		if (reducedMotion) {
			clearRevealStyles(targets, gsap);
			return () => {};
		}

		const records = [];
		for (const group of getMatchingTree(root, GROUP_SELECTOR)) {
			const record = initGroup(group, gsap, ScrollTrigger, ownerDocument, false);
			if (record) records.push(record);
		}
		for (const element of targets) {
			const record = initStandalone(element, gsap, ScrollTrigger, ownerDocument, false);
			if (record) records.push(record);
		}
		return () => cleanupRecords(records, gsap);
	};

	let mediaContext = null;
	let fallbackCleanup = null;
	if (gsap.matchMedia) {
		mediaContext = gsap.matchMedia();
		mediaContext.add(
			{
				allowMotion: ALLOW_MOTION_QUERY,
				reduceMotion: REDUCED_MOTION_QUERY,
			},
			(context) => setup(Boolean(context.conditions?.reduceMotion)),
		);
	} else {
		const reducedMotion = Boolean(ownerWindow.matchMedia?.(REDUCED_MOTION_QUERY)?.matches);
		fallbackCleanup = setup(reducedMotion);
	}

	const cleanup = () => {
		mediaContext?.revert?.();
		fallbackCleanup?.();
		initializedRoots.delete(root);
	};
	initializedRoots.set(root, cleanup);
	return cleanup;
}
