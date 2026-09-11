const DESKTOP_QUERY = "(min-width: 768px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const DURATION = 0.4;
const EASE = "power2.out";

const selectors = {
	component: ".values",
	items: ".values_items",
	item: ".value-item",
	media: ".values_media",
	mediaIndex: ".values_media-index",
	stage: ".values_media-stage",
};

const initializedRoots = new WeakMap();
const componentRecords = new WeakMap();
const warnedElements = new WeakSet();

function getMatchingTree(root, selector) {
	return [
		...(root.matches?.(selector) ? [root] : []),
		...(root.querySelectorAll?.(selector) ?? []),
	];
}

function getOwnedMatches(root, selector, ownerSelector) {
	return [...root.querySelectorAll(selector)].filter(
		(element) => element.closest(ownerSelector) === root,
	);
}

function getOwnedMatch(root, selector, ownerSelector) {
	return getOwnedMatches(root, selector, ownerSelector)[0] ?? null;
}

function getItems(itemsElement) {
	return getOwnedMatches(itemsElement, selectors.item, selectors.items);
}

function getItemMedia(item) {
	return getOwnedMatch(item, selectors.media, selectors.item);
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

function removeStagePlaceholders(record) {
	getOwnedMatches(
		record.stage ?? record.element,
		`${selectors.media}.is-placeholder`,
		selectors.stage,
	).forEach((node) => node.remove());
}

function syncSources(record) {
	const items = getItems(record.itemsElement);
	record.sources = [];

	items.forEach((item, index) => {
		const media = getItemMedia(item);
		if (!media) {
			warnOnce(item, "[values] Skipped an item because it needs a .values_media element.");
			return;
		}

		getOwnedMatch(media, selectors.mediaIndex, selectors.media)?.replaceChildren(
			formatIndex(index + 1, items.length),
		);
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

	const staleClones = [...record.clones.values()].filter(
		(clone) => clone !== previousClone && clone !== nextClone,
	);
	if (staleClones.length) record.gsap.set(staleClones, { autoAlpha: 0 });
	record.gsap.to(previousClone, { autoAlpha: 0, duration, ease: EASE, overwrite: "auto" });
	record.gsap.to(nextClone, { autoAlpha: 1, duration, ease: EASE, overwrite: "auto" });
}

function buildDesktopStack(record) {
	if (!record.stage) return;
	removeStagePlaceholders(record);
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
	const initialItem =
		record.activeItem && record.clones.has(record.activeItem)
			? record.activeItem
			: (openSource?.item ?? record.sources[0]?.item);
	record.activeItem = null;
	activateItem(record, initialItem, false);
}

function destroyDesktopStack(record) {
	record.gsap.killTweensOf([...record.clones.values()]);
	record.clones.forEach((clone) => clone.remove());
	record.clones.clear();
	record.activeClone = null;
	record.isDesktop = false;
}

function rebuildForItemsChange(record) {
	const previousActiveItem = record.activeItem;
	if (record.isDesktop) destroyDesktopStack(record);
	syncSources(record);

	const stillPresent = record.sources.some(({ item }) => item === previousActiveItem);
	record.activeItem = stillPresent
		? previousActiveItem
		: (record.sources.find(({ item }) => item.classList.contains("is-open"))?.item ??
			record.sources[0]?.item ??
			null);

	if (record.mediaQuery?.matches) buildDesktopStack(record);
}

function createComponentRecord(component, gsap) {
	const existingRecord = componentRecords.get(component);
	if (existingRecord) return existingRecord;

	const itemsElement = getOwnedMatch(component, selectors.items, selectors.component);
	if (!itemsElement) {
		warnOnce(component, "[values] Skipped a component because it needs a .values_items element.");
		return null;
	}

	const stage = getOwnedMatch(component, selectors.stage, selectors.component);
	if (!stage) {
		warnOnce(
			component,
			"[values] Skipped desktop media because the component needs a .values_media-stage element.",
		);
	}
	removeStagePlaceholders({ element: component, stage });
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
		if (
			mutations.some(
				(mutation) => mutation.type === "childList" && mutation.target === record.itemsElement,
			)
		) {
			rebuildForItemsChange(record);
		}

		for (const mutation of mutations) {
			if (
				mutation.type === "attributes" &&
				mutation.target.matches(selectors.item) &&
				mutation.target.closest(selectors.component) === record.element &&
				mutation.target.classList.contains("is-open")
			)
				activateItem(record, mutation.target);
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
	record.observer?.disconnect();
	record.mediaQuery?.removeEventListener?.("change", record.onMediaChange);
	destroyDesktopStack(record);
	record.sources = [];
	componentRecords.delete(record.element);
}

export function initValues(root = document, gsap = globalThis.gsap) {
	const existingCleanup = initializedRoots.get(root);
	if (existingCleanup) return existingCleanup;

	if (!gsap?.set || !gsap?.to || !gsap?.killTweensOf) {
		console.warn("[values] GSAP was not found. Load GSAP before initializing Values.");
		return () => {};
	}

	const records = new Set();
	const initializeComponent = (component) => {
		if (componentRecords.has(component)) return;
		const record = createComponentRecord(component, gsap);
		if (record) records.add(record);
	};
	getMatchingTree(root, selectors.component).forEach(initializeComponent);

	const rootObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			for (const removedNode of mutation.removedNodes) {
				if (removedNode.nodeType !== 1) continue;
				for (const component of getMatchingTree(removedNode, selectors.component)) {
					const record = componentRecords.get(component);
					if (!records.has(record)) continue;
					destroyComponentRecord(record);
					records.delete(record);
				}
			}
		}

		for (const mutation of mutations) {
			for (const addedNode of mutation.addedNodes) {
				if (addedNode.nodeType !== 1) continue;
				for (const component of getMatchingTree(addedNode, selectors.component)) {
					if (root !== component && !root.contains?.(component)) continue;
					initializeComponent(component);
				}
			}
		}
	});
	rootObserver.observe(root, { childList: true, subtree: true });
	let isCleanedUp = false;
	const cleanup = () => {
		if (isCleanedUp) return;
		isCleanedUp = true;
		rootObserver.disconnect();
		records.forEach(destroyComponentRecord);
		records.clear();
		initializedRoots.delete(root);
	};

	initializedRoots.set(root, cleanup);
	return cleanup;
}
