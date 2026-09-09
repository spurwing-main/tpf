const DESKTOP_QUERY = "(min-width: 768px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const DURATION = 0.4;
const EASE = "power2.out";

const selectors = {
	component: ".values",
	items: ".values_items",
	item: ".value-item",
	media: ".values_media",
	mediaContent: ".values_media-content-inner",
	stage: ".values_media-stage",
};

const initializedRoots = new WeakMap();
const componentRecords = new WeakMap();
const warnedElements = new WeakSet();

function getMatchingTree(root, selector) {
	const matches = [];
	if (root.nodeType === 1 && root.matches(selector)) matches.push(root);
	if (typeof root.querySelectorAll === "function") matches.push(...root.querySelectorAll(selector));
	return matches;
}

function getItems(itemsElement) {
	return [...itemsElement.children].filter((child) => child.matches(selectors.item));
}

function getItemMedia(item) {
	return [...item.children].find((child) => child.matches(selectors.media)) ?? null;
}

function formatIndex(position, total) {
	const width = Math.max(2, String(total).length);
	return `${String(position).padStart(width, "0")} / ${String(total).padStart(width, "0")}`;
}

function warnOnce(element, message) {
	if (warnedElements.has(element)) return;
	warnedElements.add(element);
	console.warn(message);
}

function removeGeneratedIndices(record) {
	record.element.querySelectorAll('[data-values-generated="index"]').forEach((node) => node.remove());
}

function syncSources(record) {
	removeGeneratedIndices(record);
	const items = getItems(record.itemsElement);
	record.sources = [];

	items.forEach((item, index) => {
		const media = getItemMedia(item);
		const content = media?.querySelector(selectors.mediaContent);
		if (!media || !content) {
			warnOnce(item, "[values] Skipped an item because its media subcomponent is incomplete.");
			return;
		}

		const indexElement = item.ownerDocument.createElement("div");
		indexElement.className = "values_media-index";
		indexElement.dataset.valuesGenerated = "index";
		indexElement.textContent = formatIndex(index + 1, items.length);
		content.append(indexElement);
		record.sources.push({ item, media });
	});
}

function setCloneState(record, clone, isActive) {
	clone.classList.toggle("is-active", isActive);
	clone.setAttribute("aria-hidden", String(!isActive));
	clone.toggleAttribute("inert", !isActive);
}

function activateItem(record, item, animate = true) {
	if (!item || item === record.activeItem) return;
	record.activeItem = item;
	if (!record.isDesktop) return;

	const nextClone = record.clones.get(item);
	if (!nextClone) return;
	const previousClone = record.activeClone;
	record.gsap.killTweensOf([...record.clones.values()]);

	for (const clone of record.clones.values()) setCloneState(record, clone, clone === nextClone);
	record.activeClone = nextClone;

	const duration = record.view.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ? 0 : DURATION;
	if (!animate || !previousClone || previousClone === nextClone) {
		record.gsap.set([...record.clones.values()], { autoAlpha: 0 });
		record.gsap.set(nextClone, { autoAlpha: 1 });
		return;
	}

	record.gsap.to(previousClone, { autoAlpha: 0, duration, ease: EASE, overwrite: "auto" });
	record.gsap.to(nextClone, { autoAlpha: 1, duration, ease: EASE, overwrite: "auto" });
}

function buildDesktopStack(record) {
	if (!record.stage) return;
	record.isDesktop = true;
	record.clones = new Map();

	for (const source of record.sources) {
		const clone = source.media.cloneNode(true);
		clone.dataset.valuesGenerated = "media";
		record.stage.append(clone);
		record.clones.set(source.item, clone);
		setCloneState(record, clone, false);
	}

	const openSource = record.sources.find(({ item }) => item.classList.contains("is-open"));
	const initialItem = record.activeItem && record.clones.has(record.activeItem)
		? record.activeItem
		: openSource?.item ?? record.sources[0]?.item;
	record.activeItem = null;
	activateItem(record, initialItem, false);
}

function destroyDesktopStack(record) {
	record.gsap.killTweensOf([...record.clones.values()]);
	record.stage?.querySelectorAll('[data-values-generated="media"]').forEach((clone) => clone.remove());
	record.clones.clear();
	record.activeClone = null;
	record.isDesktop = false;
}

function createComponentRecord(component, gsap) {
	const existingRecord = componentRecords.get(component);
	if (existingRecord) return existingRecord;

	const itemsElement = [...component.querySelectorAll(selectors.items)].find(
		(element) => element.closest(selectors.component) === component,
	);
	if (!itemsElement) {
		warnOnce(component, "[values] Skipped a component because it needs a .values_items element.");
		return null;
	}

	const stage = [...component.querySelectorAll(selectors.stage)].find(
		(element) => element.closest(selectors.component) === component,
	) ?? null;
	const mediaQuery = globalThis.matchMedia?.(DESKTOP_QUERY);
	const record = {
		element: component,
		itemsElement,
		stage,
		sources: [],
		mediaQuery,
		view: globalThis,
		gsap,
		clones: new Map(),
		activeItem: null,
		activeClone: null,
		isDesktop: false,
		onMediaChange: null,
		observer: null,
	};

	record.onMediaChange = (event) => {
		if (event.matches) buildDesktopStack(record);
		else destroyDesktopStack(record);
	};
	mediaQuery?.addEventListener?.("change", record.onMediaChange);
	syncSources(record);
	record.observer = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (
				mutation.type === "attributes"
				&& mutation.target.matches(selectors.item)
				&& mutation.target.closest(selectors.component) === record.element
				&& mutation.target.classList.contains("is-open")
			) activateItem(record, mutation.target);
		}
	});
	record.observer.observe(itemsElement, {
		attributes: true,
		attributeFilter: ["class"],
		childList: true,
		subtree: true,
	});
	if (mediaQuery?.matches) buildDesktopStack(record);
	componentRecords.set(component, record);
	return record;
}

function destroyComponentRecord(record) {
	if (!record || componentRecords.get(record.element) !== record) return;
	record.mediaQuery?.removeEventListener?.("change", record.onMediaChange);
	record.observer?.disconnect();
	destroyDesktopStack(record);
	removeGeneratedIndices(record);
	record.sources = [];
	componentRecords.delete(record.element);
}

export function initValues(root = document, gsap = globalThis.gsap) {
	const existingCleanup = initializedRoots.get(root);
	if (existingCleanup) return existingCleanup;

	if (!gsap?.set || !gsap?.to || !gsap?.killTweensOf) {
		console.warn("[values] GSAP was not found. Load GSAP before initializing values.");
		return () => {};
	}

	const records = getMatchingTree(root, selectors.component)
		.map((component) => createComponentRecord(component, gsap))
		.filter(Boolean);
	let isCleanedUp = false;
	const cleanup = () => {
		if (isCleanedUp) return;
		isCleanedUp = true;
		records.forEach(destroyComponentRecord);
		initializedRoots.delete(root);
	};

	initializedRoots.set(root, cleanup);
	return cleanup;
}
