# Values Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the responsive Values media behavior while keeping the generic accordion module free of Values-specific code.

**Architecture:** A new `initValues(root, gsap)` module owns item indices, the desktop clone stack, responsive setup/teardown, and DOM observation. It reads accordion state only from `.value-item.is-open`; item-owned `.values_media` remains the source of truth and is never moved.

**Tech Stack:** JavaScript ES modules, DOM APIs, MutationObserver, matchMedia, global GSAP, Vitest, jsdom, esbuild.

**Spec:** `docs/superpowers/specs/2026-09-09-values-media-design.md`

## Global Constraints

- Do not add Values-specific behavior to `src/modules/accordions.js`.
- Use `(min-width: 768px)` as the desktop media query.
- Require the preloaded global GSAP object; do not import GSAP.
- Use `.values_media-stage` as the empty desktop mount and item-owned `.values_media` as sources.
- Never move the authored item media; clone it only while desktop is active.
- Generate index text in `01 / 03` format and recalculate it after item-list changes.
- Crossfade with `autoAlpha`, 0.4 seconds, and `power2.out`; use zero duration for reduced motion.
- Support multiple Values components and avoid duplicate initialization.
- Preserve unrelated working-tree changes.

## File Structure

- Create `src/modules/values.js`: Values component discovery, indexing, responsive lifecycle, crossfade, observation, and cleanup.
- Create `src/modules/values.test.js`: DOM behavior tests using controlled GSAP and matchMedia doubles.
- Modify `src/modules/index.js`: import and register `initValues` after `initAccordions`.
- Modify `src/modules/index.test.js`: assert the registry order and initializer identity.

---

### Task 1: Item-owned media and generated indices

**Files:**
- Create: `src/modules/values.js`
- Create: `src/modules/values.test.js`

**Interfaces:**
- Consumes: `.values`, `.values_items`, direct `.value-item`, direct item-owned `.values_media`, and `.values_media-content-inner`.
- Produces: `initValues(root = document, gsap = globalThis.gsap)`, returning an idempotent cleanup function.

- [ ] **Step 1: Write the test fixture and failing index tests**

Create `src/modules/values.test.js` with a fixture that renders one Values component containing three item-owned media cards and an empty stage. The fixture must use the real class hierarchy:

```js
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initValues } from "./values.js";

function mediaCard(title) {
	return `
		<div class="values_media">
			<img src="/${title.toLowerCase().replaceAll(" ", "-")}.jpg" alt="${title}">
			<div class="values_media-content">
				<div class="values_media-content-inner">
					<div class="values_media-title">${title}</div>
				</div>
			</div>
		</div>
	`;
}

function renderValues({ titles = ["Integrity", "Human first", "Quality"] } = {}) {
	document.body.innerHTML = `
		<section class="values">
			<div class="values_content">
				<div class="values_items" data-accordion="component">
					${titles.map((title, index) => `
						<div class="value-item${index === 0 ? " is-open" : ""}" data-accordion="item">
							<button class="value-item_header" data-accordion="trigger" type="button">${title}</button>
							<div class="value-item_content" data-accordion="content">Body</div>
							${mediaCard(title)}
						</div>
					`).join("")}
				</div>
				<div class="values_media-stage"></div>
			</div>
		</section>
	`;
}

function createMatchMedia(matches = false) {
	const listeners = new Set();
	return {
		matches,
		addEventListener: (_type, listener) => listeners.add(listener),
		removeEventListener: (_type, listener) => listeners.delete(listener),
		setMatches(nextMatches) {
			this.matches = nextMatches;
			listeners.forEach((listener) => listener({ matches: nextMatches }));
		},
	};
}

function createGsap() {
	return {
		set: vi.fn(),
		to: vi.fn(() => ({ kill: vi.fn() })),
		killTweensOf: vi.fn(),
	};
}

describe("initValues", () => {
	let cleanup;

	beforeEach(() => {
		document.body.innerHTML = "";
		cleanup = null;
		vi.restoreAllMocks();
	});

	afterEach(() => cleanup?.());

	it("generates padded position and total indices for item-owned media", () => {
		renderValues();
		const mediaQuery = createMatchMedia(false);
		vi.stubGlobal("matchMedia", vi.fn(() => mediaQuery));

		cleanup = initValues(document, createGsap());

		expect([...document.querySelectorAll(".value-item .values_media-index")].map((node) => node.textContent)).toEqual([
			"01 / 03",
			"02 / 03",
			"03 / 03",
		]);
		expect(document.querySelector(".values_media-stage").childElementCount).toBe(0);
	});

	it("removes only module-generated index nodes during cleanup", () => {
		renderValues();
		vi.stubGlobal("matchMedia", vi.fn(() => createMatchMedia(false)));
		cleanup = initValues(document, createGsap());

		cleanup();
		cleanup = null;

		expect(document.querySelectorAll('[data-values-generated="index"]')).toHaveLength(0);
		expect(document.querySelectorAll(".values_media")).toHaveLength(3);
	});
});
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
npm test -- src/modules/values.test.js
```

Expected: FAIL because `./values.js` does not exist.

- [ ] **Step 3: Implement component discovery and index generation**

Create `src/modules/values.js` with these constants and helpers:

```js
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
```

Implement `warnOnce`, `createComponentRecord`, `destroyComponentRecord`, and `initValues`. `createComponentRecord` must require `.values_items`, record an optional `.values_media-stage`, call `syncSources`, subscribe to the media query, and initially remain in the mobile lifecycle when the query does not match. `initValues` must validate `gsap.set`, `gsap.to`, and `gsap.killTweensOf`, warn when absent, prevent double initialization of the same root, initialize every `.values`, and return cleanup.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
npm test -- src/modules/values.test.js
```

Expected: both index lifecycle tests PASS.

- [ ] **Step 5: Commit the source/index lifecycle**

```bash
git add src/modules/values.js src/modules/values.test.js
git commit -m "feat: add values media source lifecycle"
```

---

### Task 2: Desktop clone stack and accordion-state crossfade

**Files:**
- Modify: `src/modules/values.js`
- Modify: `src/modules/values.test.js`

**Interfaces:**
- Consumes: Task 1 component records shaped as `{ element, itemsElement, stage, sources, mediaQuery, activeItem }`.
- Produces: desktop lifecycle functions `buildDesktopStack(record)`, `destroyDesktopStack(record)`, and `activateItem(record, item, animate)`.

- [ ] **Step 1: Add failing desktop behavior tests**

Extend the GSAP double so `set` and `to` apply `autoAlpha` as inline opacity/visibility and record tween variables. Add tests that assert:

```js
it("builds every desktop clone and initially shows the open item's media", () => {
	renderValues();
	const mediaQuery = createMatchMedia(true);
	vi.stubGlobal("matchMedia", vi.fn((query) =>
		query === "(min-width: 768px)" ? mediaQuery : { matches: false },
	));
	cleanup = initValues(document, createGsap());

	const clones = [...document.querySelectorAll('[data-values-generated="media"]')];
	expect(clones).toHaveLength(3);
	expect(clones.map((clone) => clone.querySelector(".values_media-title").textContent)).toEqual([
		"Integrity",
		"Human first",
		"Quality",
	]);
	expect(clones[0].classList.contains("is-active")).toBe(true);
	expect(clones[0].getAttribute("aria-hidden")).toBe("false");
	expect(clones[1].hasAttribute("inert")).toBe(true);
});

it("crossfades when another accordion item becomes open", async () => {
	renderValues();
	const mediaQuery = createMatchMedia(true);
	vi.stubGlobal("matchMedia", vi.fn((query) =>
		query === "(min-width: 768px)" ? mediaQuery : { matches: false },
	));
	const gsap = createGsap();
	cleanup = initValues(document, gsap);
	const [first, second] = document.querySelectorAll(".value-item");

	first.classList.remove("is-open");
	second.classList.add("is-open");
	await Promise.resolve();

	const clones = [...document.querySelectorAll('[data-values-generated="media"]')];
	expect(clones[0].classList.contains("is-active")).toBe(false);
	expect(clones[1].classList.contains("is-active")).toBe(true);
	expect(gsap.killTweensOf).toHaveBeenCalled();
	expect(gsap.to).toHaveBeenCalledWith(clones[1], expect.objectContaining({
		autoAlpha: 1,
		duration: 0.4,
		ease: "power2.out",
		overwrite: "auto",
	}));
});

it("keeps the last media selected when its accordion item closes", async () => {
	renderValues();
	vi.stubGlobal("matchMedia", vi.fn((query) => ({ matches: query.includes("min-width") })));
	cleanup = initValues(document, createGsap());
	const first = document.querySelector(".value-item");

	first.classList.remove("is-open");
	await Promise.resolve();

	expect(document.querySelector('[data-values-generated="media"].is-active .values_media-title').textContent).toBe("Integrity");
});
```

Add a reduced-motion test that expects `duration: 0` for both incoming and outgoing tweens.

- [ ] **Step 2: Run the desktop tests and verify RED**

Run:

```bash
npm test -- src/modules/values.test.js
```

Expected: FAIL because no desktop clones or crossfade behavior exist.

- [ ] **Step 3: Implement clone-stack construction and activation**

Add these behaviors to `src/modules/values.js`:

```js
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

	const duration = record.view.matchMedia(REDUCED_MOTION_QUERY).matches ? 0 : DURATION;
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
```

Create one component-scoped MutationObserver on `.values_items` with `{ attributes: true, attributeFilter: ["class"], childList: true, subtree: true }`. For attribute mutations, react only when `mutation.target.matches(".value-item")` and it now has `.is-open`; call `activateItem(record, mutation.target)`.

Wire the desktop media-query listener so entering calls `buildDesktopStack` and exiting calls `destroyDesktopStack`.

- [ ] **Step 4: Run the desktop tests and verify GREEN**

Run:

```bash
npm test -- src/modules/values.test.js
```

Expected: index and desktop crossfade tests PASS.

- [ ] **Step 5: Commit desktop behavior**

```bash
git add src/modules/values.js src/modules/values.test.js
git commit -m "feat: add desktop values media crossfade"
```

---

### Task 3: Dynamic items, responsive rebuilding, warnings, and cleanup

**Files:**
- Modify: `src/modules/values.js`
- Modify: `src/modules/values.test.js`

**Interfaces:**
- Consumes: Task 2 clone stack and component record lifecycle.
- Produces: root-level automatic component discovery/removal, item-list synchronization, robust cleanup, and warning behavior.

- [ ] **Step 1: Add failing lifecycle and error tests**

Add focused tests for each behavior:

1. Set the desktop media query from `false` to `true`; expect three generated clones and the currently open mobile item active.
2. Set it from `true` to `false`; expect zero generated clones while all three original item media remain.
3. Append a fourth direct `.value-item`; after the observer flush expect `01 / 04` through `04 / 04`, and expect the new item not to become active.
4. Remove or reorder an item; expect positions and total to be recalculated in DOM order.
5. Render two `.values` components, open an item in the second, and expect only the second stage to change.
6. Call `initValues` twice with the same root; expect only one set of clones and one reaction to a state change.
7. Remove a `.values` component and flush MutationObserver; expect its active tweens killed and generated nodes removed.
8. Call full cleanup; expect media-query listeners and observers detached, desktop clones removed, generated source indices removed, and later class/DOM changes ignored.
9. Omit GSAP; expect `[values] GSAP was not found. Load GSAP before initializing Values.` and a no-op cleanup.
10. Omit `.values_media-stage`; expect one warning and working mobile indices.
11. Omit one item's `.values_media` or `.values_media-content-inner`; expect one warning for that item while valid items still work.
12. Append and immediately remove a Values component before the root observer flush; expect it never to initialize.

Use a `flushMutations()` helper implemented as:

```js
async function flushMutations() {
	await new Promise((resolve) => setTimeout(resolve, 0));
}
```

- [ ] **Step 2: Run the lifecycle tests and verify RED**

Run:

```bash
npm test -- src/modules/values.test.js
```

Expected: FAIL for unsynchronized item lists, incomplete cleanup, missing warnings, and dynamic component handling.

- [ ] **Step 3: Implement item synchronization and root observation**

For component observer child-list mutations, synchronize only when `mutation.target === record.itemsElement`; this avoids responding to the module's own generated index nodes. Implement:

```js
function rebuildForItemsChange(record) {
	const previousActiveItem = record.activeItem;
	if (record.isDesktop) destroyDesktopStack(record);
	syncSources(record);

	const stillPresent = record.sources.some(({ item }) => item === previousActiveItem);
	record.activeItem = stillPresent
		? previousActiveItem
		: record.sources.find(({ item }) => item.classList.contains("is-open"))?.item
			?? record.sources[0]?.item
			?? null;

	if (record.mediaQuery.matches) buildDesktopStack(record);
}
```

At root scope, observe `{ childList: true, subtree: true }`. Process removals before additions. Initialize added `.values` trees only if they remain contained by the observation root, mirroring the detached-node guard in `accordions.js`. Destroy component records for removed `.values` trees.

`destroyComponentRecord` must:

```js
record.observer.disconnect();
record.mediaQuery.removeEventListener("change", record.onMediaChange);
destroyDesktopStack(record);
removeGeneratedIndices(record);
componentRecords.delete(record.element);
```

The root cleanup must disconnect its root observer, destroy all component records owned by that initialization, delete its `initializedRoots` entry, and be safe when called more than once.

Implement `warnOnce(element, message)` with `warnedElements` so repeated mutation passes do not repeat the same warning.

- [ ] **Step 4: Run lifecycle tests and verify GREEN**

Run:

```bash
npm test -- src/modules/values.test.js
```

Expected: every Values test PASS with no unexpected console warnings.

- [ ] **Step 5: Commit lifecycle behavior**

```bash
git add src/modules/values.js src/modules/values.test.js
git commit -m "feat: handle dynamic values media lifecycle"
```

---

### Task 4: Register Values after accordions and verify the bundle

**Files:**
- Modify: `src/modules/index.js`
- Modify: `src/modules/index.test.js`

**Interfaces:**
- Consumes: `initValues(root = document, gsap = globalThis.gsap)` from Task 3.
- Produces: `{ name: "values", init: initValues }` in the site module registry after `{ name: "accordions", init: initAccordions }`.

- [ ] **Step 1: Write the failing registry-order test**

Update `src/modules/index.test.js`:

```js
import { initAccordions } from "./accordions.js";
import { modules } from "./index.js";
import { initValues } from "./values.js";

it("starts Values after accordions so initial open state is available", () => {
	const accordionIndex = modules.findIndex(({ init }) => init === initAccordions);
	const valuesIndex = modules.findIndex(({ init }) => init === initValues);

	expect(accordionIndex).toBeGreaterThanOrEqual(0);
	expect(valuesIndex).toBe(accordionIndex + 1);
	expect(modules[valuesIndex]).toEqual({ name: "values", init: initValues });
});
```

- [ ] **Step 2: Run the registry test and verify RED**

Run:

```bash
npm test -- src/modules/index.test.js
```

Expected: FAIL because `initValues` is not registered.

- [ ] **Step 3: Register the module directly after accordions**

Update `src/modules/index.js`:

```js
import { initAccordions } from "./accordions.js";
import { initCardSlider } from "./card-slider.js";
import { initNav } from "./nav.js";
import { initValues } from "./values.js";

export const modules = [
	{ name: "nav", init: initNav },
	{ name: "cardSlider", init: initCardSlider },
	{ name: "accordions", init: initAccordions },
	{ name: "values", init: initValues },
];
```

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
npm test -- src/modules/values.test.js src/modules/index.test.js src/modules/accordions.test.js src/boot.test.js src/index.test.js
npm test
node --check src/modules/values.js
npm run build
git diff --check
```

Expected: all tests PASS, syntax check exits zero, esbuild completes, and `git diff --check` emits no errors.

- [ ] **Step 5: Commit integration**

```bash
git add src/modules/index.js src/modules/index.test.js dist/bundle.js
git commit -m "feat: register values media module"
```

---

## Final Acceptance Checklist

- [ ] `accordions.js` has no Values-specific changes.
- [ ] Item-owned `.values_media` nodes never move from their `.value-item`.
- [ ] The desktop stage contains one generated clone per valid item.
- [ ] The first or currently open item is selected on desktop entry.
- [ ] Opening another item crossfades its clone; closing it does not blank the stage.
- [ ] Mobile teardown removes desktop clones and preserves source media.
- [ ] Indices remain correct after CMS insertion, removal, and reordering.
- [ ] Reduced motion disables crossfade duration.
- [ ] Multiple components, malformed markup, missing GSAP, double initialization, detached additions, and cleanup are covered.
- [ ] The Values module starts immediately after accordions.
- [ ] The focused suite, full suite, syntax check, production build, and diff check pass.
