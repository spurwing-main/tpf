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

function createComponentRecord(component) {
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
		isDesktop: Boolean(mediaQuery?.matches),
		onMediaChange: null,
	};

	record.onMediaChange = (event) => {
		record.isDesktop = event.matches;
	};
	mediaQuery?.addEventListener?.("change", record.onMediaChange);
	syncSources(record);
	componentRecords.set(component, record);
	return record;
}

function destroyComponentRecord(record) {
	if (!record || componentRecords.get(record.element) !== record) return;
	record.mediaQuery?.removeEventListener?.("change", record.onMediaChange);
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
		.map((component) => createComponentRecord(component))
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
