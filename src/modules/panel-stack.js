const DESKTOP_QUERY = "(min-width: 768px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const STATE_CHANGE_EVENT = "panel-stack:statechange";
const DURATION = 0.4;
const EASE = "power2.out";

const selectors = {
	component: "[data-panel-stack]",
	list: "[data-panel-stack-list]",
	item: "[data-panel-stack-item]",
	source: "[data-panel-stack-source]",
	index: "[data-panel-stack-index]",
	stage: "[data-panel-stack-stage]",
	placeholder: "[data-panel-stack-placeholder]",
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

function getItems(record) {
	return getOwnedMatches(record.list, selectors.item, selectors.list);
}

function getItemSource(item) {
	return getOwnedMatch(item, selectors.source, selectors.item);
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
	getOwnedMatches(record.stage ?? record.element, selectors.placeholder, selectors.stage).forEach(
		(node) => node.remove(),
	);
}

function syncSources(record) {
	const sources = [];

	getItems(record).forEach((item) => {
		const source = getItemSource(item);
		if (!source) {
			warnOnce(
				item,
				"[panel-stack] Skipped an item because it needs a [data-panel-stack-source] element.",
			);
			return;
		}
		sources.push({ item, source });
	});

	record.sources = sources;
	sources.forEach(({ source }, index) => {
		getOwnedMatch(source, selectors.index, selectors.source)?.replaceChildren(
			formatIndex(index + 1, sources.length),
		);
	});
}

function setCloneState(record, clone, isActive) {
	clone.classList.toggle("is-active", isActive);
	clone.setAttribute("aria-hidden", String(!isActive));
	clone.toggleAttribute("inert", !isActive);
}

function getActiveSource(record) {
	if (record.isDesktop) return record.activeClone;
	return record.sources.find(({ item }) => item === record.activeItem)?.source ?? null;
}

function dispatchStateChange(record, previousSource = null) {
	const view = record.element.ownerDocument?.defaultView ?? globalThis;
	const CustomEventConstructor = view.CustomEvent ?? globalThis.CustomEvent;
	if (!CustomEventConstructor) return;

	const sources = record.isDesktop
		? [...record.clones.values()]
		: record.sources.map(({ source }) => source);
	record.element.dispatchEvent(
		new CustomEventConstructor(STATE_CHANGE_EVENT, {
			bubbles: true,
			detail: {
				mode: record.isDesktop ? "desktop" : "mobile",
				sources,
				activeSource: getActiveSource(record),
				previousSource,
			},
		}),
	);
}

function activateItem(record, item, animate = true, previousSourceOverride) {
	if (!item || item === record.activeItem) return;
	const previousSource = previousSourceOverride ?? getActiveSource(record);
	record.activeItem = item;
	if (!record.isDesktop) {
		dispatchStateChange(record, previousSource);
		return;
	}

	const nextClone = record.clones.get(item);
	if (!nextClone) {
		dispatchStateChange(record, previousSource);
		return;
	}
	const previousClone = record.activeClone;
	record.gsap.killTweensOf([...record.clones.values()]);

	for (const clone of record.clones.values()) setCloneState(record, clone, clone === nextClone);
	record.activeClone = nextClone;
	dispatchStateChange(record, previousSource);

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

function buildDesktopStack(record, previousSource = null) {
	if (!record.stage) {
		dispatchStateChange(record, previousSource);
		return;
	}
	removeStagePlaceholders(record);
	record.isDesktop = true;
	record.clones = new Map();

	for (const { item, source } of record.sources) {
		const clone = source.cloneNode(true);
		clone.dataset.panelStackGenerated = "source";
		record.stage.append(clone);
		record.clones.set(item, clone);
		setCloneState(record, clone, false);
	}

	const openSource = record.sources.find(({ item }) => item.classList.contains("is-open"));
	const initialItem =
		record.activeItem && record.clones.has(record.activeItem)
			? record.activeItem
		: (openSource?.item ?? record.sources[0]?.item);
	record.activeItem = null;
	if (initialItem) activateItem(record, initialItem, false, previousSource);
	else dispatchStateChange(record, previousSource);
}

function destroyDesktopStack(record) {
	record.gsap.killTweensOf([...record.clones.values()]);
	record.clones.forEach((clone) => clone.remove());
	record.clones.clear();
	record.activeClone = null;
	record.isDesktop = false;
}

function rebuildForItemsChange(record) {
	const previousSource = getActiveSource(record);
	const previousActiveItem = record.activeItem;
	if (record.isDesktop) destroyDesktopStack(record);
	syncSources(record);

	const stillPresent = record.sources.some(({ item }) => item === previousActiveItem);
	record.activeItem = stillPresent
		? previousActiveItem
		: (record.sources.find(({ item }) => item.classList.contains("is-open"))?.item ??
			record.sources[0]?.item ??
			null);

	if (record.mediaQuery?.matches) buildDesktopStack(record, previousSource);
	else dispatchStateChange(record, previousSource);
}

function createComponentRecord(component, gsap) {
	const existingRecord = componentRecords.get(component);
	if (existingRecord) return existingRecord;

	const list = getOwnedMatch(component, selectors.list, selectors.component);
	if (!list) {
		warnOnce(
			component,
			"[panel-stack] Skipped a component because it needs a [data-panel-stack-list] element.",
		);
		return null;
	}

	const stage = getOwnedMatch(component, selectors.stage, selectors.component);
	if (!stage) {
		warnOnce(
			component,
			"[panel-stack] Skipped desktop stacking because the component needs a [data-panel-stack-stage] element.",
		);
	}
	removeStagePlaceholders({ element: component, stage });

	const mediaQuery = globalThis.matchMedia?.(DESKTOP_QUERY);
	const record = {
		element: component,
		list,
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
		const previousSource = getActiveSource(record);
		if (event.matches) buildDesktopStack(record, previousSource);
		else {
			destroyDesktopStack(record);
			dispatchStateChange(record, previousSource);
		}
	};
	mediaQuery?.addEventListener?.("change", record.onMediaChange);
	syncSources(record);
	record.observer = new MutationObserver((mutations) => {
		if (
			mutations.some((mutation) => mutation.type === "childList" && mutation.target === record.list)
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
	record.observer.observe(list, {
		attributes: true,
		attributeFilter: ["class"],
		childList: true,
		subtree: true,
	});
	const initialItem =
		record.sources.find(({ item }) => item.classList.contains("is-open"))?.item ??
		record.sources[0]?.item ??
		null;
	record.activeItem = initialItem;
	if (mediaQuery?.matches) buildDesktopStack(record);
	else dispatchStateChange(record);
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

export function initPanelStack(root = document, gsap = globalThis.gsap) {
	const existingCleanup = initializedRoots.get(root);
	if (existingCleanup) return existingCleanup;

	if (!gsap?.set || !gsap?.to || !gsap?.killTweensOf) {
		console.warn("[panel-stack] GSAP was not found. Load GSAP before initializing panel stacks.");
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
