export const LOGO_REVOLVER_DEFAULTS = Object.freeze({
	mobileQuery: "(max-width: 767px)",
	reducedMotionQuery: "(prefers-reduced-motion: reduce)",
	mobileSlots: 2,
	stepMs: 5500,
	staggerMs: 400,
	transitionMs: 650,
});

const ROOT_SELECTOR = '[data-logo-revolver="root"]';
const SOURCE_SELECTOR = '[data-logo-revolver="source"]';
const DESKTOP_SELECTOR = '[data-logo-revolver="desktop"]';
const LOGO_SELECTOR = '[data-logo-revolver="logo"]';
const COPY_ATTRIBUTES = ["src", "srcset", "sizes", "width", "height"];
const initializedRoots = new WeakMap();

export function partitionLogos(logos, requestedSlots) {
	const slotCount = Math.min(logos.length, Math.max(0, Math.floor(requestedSlots)));
	if (slotCount === 0) return [];

	const groups = Array.from({ length: slotCount }, () => []);
	logos.forEach((logo, index) => groups[index % slotCount].push(logo));
	return groups;
}

function findRoots(root) {
	return [
		...(root?.nodeType === 1 && root.matches(ROOT_SELECTOR) ? [root] : []),
		...(root?.querySelectorAll?.(ROOT_SELECTOR) ?? []),
	];
}

function readLogos(component) {
	const source = component.querySelector(SOURCE_SELECTOR);
	if (!source) return [];

	return [...source.querySelectorAll(LOGO_SELECTOR)]
		.map((image) => ({
			src: image.currentSrc || image.getAttribute("src") || "",
			srcset: image.getAttribute("srcset") || "",
			sizes: image.getAttribute("sizes") || "",
			alt: image.getAttribute("alt") || "",
			width: image.getAttribute("width") || "",
			height: image.getAttribute("height") || "",
		}))
		.filter(({ src }) => src);
}

function applyLogo(image, logo, visible) {
	COPY_ATTRIBUTES.forEach((attribute) => {
		if (logo[attribute]) image.setAttribute(attribute, logo[attribute]);
		else image.removeAttribute(attribute);
	});
	image.alt = logo.alt;
	image.setAttribute("aria-hidden", String(!visible));
}

function createLayer(document) {
	const image = document.createElement("img");
	image.dataset.logoRevolver = "layer";
	image.className = "client-logos_revolver-img";
	image.decoding = "async";
	image.loading = "eager";
	return image;
}

function createSlot(document, group, slotIndex, state) {
	const slot = document.createElement("div");
	slot.className = "client-logos_revolver-slot";
	slot.dataset.logoRevolver = "slot";

	const current = createLayer(document);
	applyLogo(current, group[0], true);
	current.classList.add("is-current");
	slot.append(current);

	if (group.length === 1 || state.reducedMotion) return slot;

	const next = createLayer(document);
	applyLogo(next, group[1], false);
	slot.append(next);

	const slotState = { current, next, nextIndex: 2 % group.length };
	const schedule = (delay) => {
		const timer = state.view.setTimeout(() => {
			state.timers.delete(timer);
			if (state.generation !== state.generationAtBuild) return;

			slotState.current.classList.remove("is-current");
			slotState.current.classList.add("is-leaving");
			slotState.next.classList.add("is-current");
			slotState.current.setAttribute("aria-hidden", "true");
			slotState.next.setAttribute("aria-hidden", "false");

			const transitionTimer = state.view.setTimeout(() => {
				state.timers.delete(transitionTimer);
				if (state.generation !== state.generationAtBuild) return;

				slot.classList.add("is-resetting");
				slotState.current.classList.remove("is-leaving");
				const outgoing = slotState.current;
				slotState.current = slotState.next;
				slotState.next = outgoing;
				applyLogo(slotState.next, group[slotState.nextIndex], false);
				slotState.nextIndex = (slotState.nextIndex + 1) % group.length;
				void slot.offsetWidth;
				slot.classList.remove("is-resetting");
				schedule(state.options.stepMs - state.options.transitionMs);
			}, state.options.transitionMs);
			state.timers.add(transitionTimer);
		}, delay);
		state.timers.add(timer);
	};

	schedule(state.options.stepMs + slotIndex * state.options.staggerMs);
	return slot;
}

export function initLogoRevolver(root = document, view = globalThis, options = LOGO_REVOLVER_DEFAULTS) {
	const componentRoots = findRoots(root);
	const existing = componentRoots.map((component) => initializedRoots.get(component)).find(Boolean);
	if (existing) return existing;

	const document = root.nodeType === 9 ? root : root.ownerDocument;
	const mobileQuery = view.matchMedia?.(options.mobileQuery);
	const reducedMotionQuery = view.matchMedia?.(options.reducedMotionQuery);
	if (!document || !mobileQuery || !reducedMotionQuery) return () => {};

	const state = {
		view,
		options,
		mobileQuery,
		reducedMotionQuery,
		timers: new Set(),
		generation: 0,
		debounceTimer: null,
		outputs: new Set(),
	};

	const clearTimers = () => {
		state.timers.forEach((timer) => state.view.clearTimeout(timer));
		state.timers.clear();
		state.generation += 1;
	};

	const rebuild = () => {
		clearTimers();
		state.outputs.forEach((output) => output.remove());
		state.outputs.clear();
		componentRoots.forEach((component) => component.removeAttribute("data-logo-revolver-mounted"));
		if (!state.mobileQuery.matches) return;

		componentRoots.forEach((component) => {
			const desktop = component.querySelector(DESKTOP_SELECTOR);
			const logos = readLogos(component);
			if (!desktop || logos.length === 0) return;

			const output = document.createElement("div");
			output.className = "client-logos_revolver";
			output.dataset.logoRevolver = "output";
			output.setAttribute("role", "group");
			output.setAttribute("aria-label", "Client logos");
			const componentState = {
				...state,
				generationAtBuild: state.generation,
				reducedMotion: state.reducedMotionQuery.matches,
			};
			partitionLogos(logos, options.mobileSlots).forEach((group, index) =>
				output.append(createSlot(document, group, index, componentState)),
			);
			desktop.before(output);
			state.outputs.add(output);
			component.setAttribute("data-logo-revolver-mounted", "");
		});
	};

	const onMediaChange = () => {
		if (state.debounceTimer !== null) state.view.clearTimeout(state.debounceTimer);
		state.debounceTimer = state.view.setTimeout(() => {
			state.debounceTimer = null;
			rebuild();
		}, 100);
	};

	const cleanup = () => {
		if (state.debounceTimer !== null) state.view.clearTimeout(state.debounceTimer);
		state.debounceTimer = null;
		clearTimers();
		state.outputs.forEach((output) => output.remove());
		state.outputs.clear();
		componentRoots.forEach((component) => {
			component.removeAttribute("data-logo-revolver-mounted");
			initializedRoots.delete(component);
		});
		mobileQuery.removeEventListener?.("change", onMediaChange);
		reducedMotionQuery.removeEventListener?.("change", onMediaChange);
	};

	mobileQuery.addEventListener?.("change", onMediaChange);
	reducedMotionQuery.addEventListener?.("change", onMediaChange);
	componentRoots.forEach((component) => initializedRoots.set(component, cleanup));
	rebuild();
	return cleanup;
}
