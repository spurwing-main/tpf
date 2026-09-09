const DURATION = 0.4;
const EASE = "power2.inOut";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

const selectors = {
	component: '[data-accordion="component"]',
	item: '[data-accordion="item"]',
	trigger: '[data-accordion="trigger"]',
	content: '[data-accordion="content"]',
};

const componentRecords = new WeakMap();
const itemRecords = new WeakMap();
const initializedRoots = new WeakMap();
const warnedItems = new WeakSet();
let generatedId = 0;

function getMatchingTree(root, selector) {
	const matches = [];

	if (root.nodeType === 1 && root.matches(selector)) matches.push(root);
	if (typeof root.querySelectorAll === "function") {
		matches.push(...root.querySelectorAll(selector));
	}

	return matches;
}

function getOwnedDescendants(root, selector, ownerSelector) {
	return [...root.querySelectorAll(selector)].filter(
		(element) => element.closest(ownerSelector) === root,
	);
}

function getOwnedItemElement(item, selector) {
	return [...item.querySelectorAll(selector)].find(
		(element) => element.closest(selectors.item) === item,
	);
}

function restoreAttribute(element, name, value) {
	if (value === null) element.removeAttribute(name);
	else element.setAttribute(name, value);
}

function ensureContentId(content) {
	if (content.id) return content.id;

	const ownerDocument = content.ownerDocument;
	let id;

	do {
		generatedId += 1;
		id = `accordion-content-${generatedId}`;
	} while (ownerDocument.getElementById(id));

	content.id = id;
	return id;
}

function prefersReducedMotion(element) {
	const view = element.ownerDocument.defaultView;
	return Boolean(view?.matchMedia?.(REDUCED_MOTION_QUERY).matches);
}

function setState(record, isOpen, animate = true) {
	if (record.isOpen === isOpen && animate) return;

	record.isOpen = isOpen;
	record.animationVersion += 1;
	const animationVersion = record.animationVersion;

	record.item.classList.toggle("is-open", isOpen);
	record.trigger.setAttribute("aria-expanded", String(isOpen));
	record.content.setAttribute("aria-hidden", String(!isOpen));
	record.content.toggleAttribute("inert", !isOpen);

	record.tween?.kill();
	record.gsap.killTweensOf(record.content);
	record.tween = null;

	if (!animate) {
		record.gsap.set(
			record.content,
			isOpen
				? { clearProps: "height,overflow" }
				: { height: 0, overflow: "hidden" },
		);
		return;
	}

	record.tween = record.gsap.to(record.content, {
		height: isOpen ? "auto" : 0,
		overflow: "hidden",
		duration: prefersReducedMotion(record.content) ? 0 : DURATION,
		ease: EASE,
		overwrite: "auto",
		onComplete: () => {
			if (record.animationVersion !== animationVersion) return;

			record.tween = null;
			if (record.isOpen) {
				record.gsap.set(record.content, { clearProps: "height,overflow" });
			}
		},
	});
}

function createItemRecord(context, componentRecord, item, isInitiallyOpen) {
	if (itemRecords.has(item)) return itemRecords.get(item);

	const trigger = getOwnedItemElement(item, selectors.trigger);
	const content = getOwnedItemElement(item, selectors.content);

	if (!trigger || trigger.tagName !== "BUTTON" || !content) {
		if (!warnedItems.has(item)) {
			console.warn(
				'[accordions] Skipped a data-accordion="item" because it needs a button trigger and content element.',
			);
			warnedItems.add(item);
		}
		return null;
	}

	const record = {
		component: componentRecord,
		item,
		trigger,
		content,
		gsap: context.gsap,
		isOpen: null,
		tween: null,
		animationVersion: 0,
		onClick: null,
		initial: {
			itemWasOpen: item.classList.contains("is-open"),
			expanded: trigger.getAttribute("aria-expanded"),
			controls: trigger.getAttribute("aria-controls"),
			hidden: content.getAttribute("aria-hidden"),
			inert: content.getAttribute("inert"),
			id: content.getAttribute("id"),
			height: content.style.height,
			overflow: content.style.overflow,
		},
	};

	trigger.setAttribute("aria-controls", ensureContentId(content));
	record.onClick = () => {
		if (record.isOpen) {
			setState(record, false);
			return;
		}

		if (componentRecord.closeOthers) {
			componentRecord.items.forEach((otherRecord) => {
				if (otherRecord !== record) setState(otherRecord, false);
			});
		}

		setState(record, true);
	};

	trigger.addEventListener("click", record.onClick);
	itemRecords.set(item, record);
	componentRecord.items.push(record);
	setState(record, isInitiallyOpen, false);

	return record;
}

function destroyItem(record) {
	if (!record || itemRecords.get(record.item) !== record) return;

	record.trigger.removeEventListener("click", record.onClick);
	record.tween?.kill();
	record.gsap.killTweensOf(record.content);

	const itemIndex = record.component.items.indexOf(record);
	if (itemIndex !== -1) record.component.items.splice(itemIndex, 1);

	record.item.classList.toggle("is-open", record.initial.itemWasOpen);
	restoreAttribute(record.trigger, "aria-expanded", record.initial.expanded);
	restoreAttribute(record.trigger, "aria-controls", record.initial.controls);
	restoreAttribute(record.content, "aria-hidden", record.initial.hidden);
	restoreAttribute(record.content, "inert", record.initial.inert);
	restoreAttribute(record.content, "id", record.initial.id);
	record.content.style.height = record.initial.height;
	record.content.style.overflow = record.initial.overflow;

	itemRecords.delete(record.item);
}

function createComponentRecord(context, component) {
	const existingRecord = componentRecords.get(component);
	if (existingRecord) return existingRecord;

	const record = {
		element: component,
		closeOthers: component.getAttribute("data-accordion-close-others") !== "false",
		items: [],
	};
	const openFirst = component.getAttribute("data-accordion-first-open") === "true";
	const items = getOwnedDescendants(component, selectors.item, selectors.component);

	componentRecords.set(component, record);
	context.components.add(record);
	items.forEach((item, index) => {
		createItemRecord(context, record, item, openFirst && index === 0);
	});

	return record;
}

function destroyComponent(context, record) {
	if (!record || componentRecords.get(record.element) !== record) return;

	[...record.items].forEach(destroyItem);
	componentRecords.delete(record.element);
	context.components.delete(record);
}

function initAddedTree(context, node) {
	if (node.nodeType !== 1) return;
	if (context.observationRoot !== node && !context.observationRoot?.contains(node)) return;

	getMatchingTree(node, selectors.component).forEach((component) => {
		createComponentRecord(context, component);
	});

	const candidates = new Set(getMatchingTree(node, selectors.item));
	const closestItem = node.closest(selectors.item);
	if (closestItem) candidates.add(closestItem);

	candidates.forEach((item) => {
		const component = item.closest(selectors.component);
		const componentRecord = component && componentRecords.get(component);

		if (componentRecord && item.closest(selectors.component) === component) {
			createItemRecord(context, componentRecord, item, false);
		}
	});
}

function destroyRemovedTree(context, node) {
	if (node.nodeType !== 1) return;

	getMatchingTree(node, selectors.item).forEach((item) => {
		destroyItem(itemRecords.get(item));
	});

	getMatchingTree(node, selectors.component).forEach((component) => {
		destroyComponent(context, componentRecords.get(component));
	});
}

export function initAccordions(root = document, gsap = globalThis.gsap) {
	const existingCleanup = initializedRoots.get(root);
	if (existingCleanup) return existingCleanup;

	if (!gsap?.set || !gsap?.to || !gsap?.killTweensOf) {
		console.warn("[accordions] GSAP was not found. Load GSAP before initializing accordions.");
		return () => {};
	}

	const observationRoot = root.nodeType === 9 ? root.documentElement : root;
	const context = {
		gsap,
		components: new Set(),
		observer: null,
		observationRoot,
		isCleanedUp: false,
	};

	getMatchingTree(root, selectors.component).forEach((component) => {
		createComponentRecord(context, component);
	});

	const Observer = root.ownerDocument?.defaultView?.MutationObserver ?? root.defaultView?.MutationObserver;

	if (observationRoot && Observer) {
		context.observer = new Observer((mutations) => {
			mutations.forEach((mutation) => {
				mutation.removedNodes.forEach((node) => destroyRemovedTree(context, node));
			});
			mutations.forEach((mutation) => {
				mutation.addedNodes.forEach((node) => initAddedTree(context, node));
			});
		});
		context.observer.observe(observationRoot, { childList: true, subtree: true });
	}

	const cleanup = () => {
		if (context.isCleanedUp) return;
		context.isCleanedUp = true;
		context.observer?.disconnect();
		[...context.components].forEach((record) => destroyComponent(context, record));
		initializedRoots.delete(root);
	};

	initializedRoots.set(root, cleanup);
	return cleanup;
}
