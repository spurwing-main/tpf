# Values Media Design

## Purpose

Add the responsive media behavior for the Values section without adding Values-specific responsibilities to the reusable accordion module.

On desktop, opening an accordion item updates a persistent right-hand media stage with a crossfade. On mobile, each item's media remains inside that accordion item. The first item's media is shown on initial desktop load.

## Existing Markup

The published page uses this Values structure:

```text
.values
└── .values_content
    ├── .values_items[data-accordion="component"][data-accordion-first-open="true"]
    │   └── .value-item[data-accordion="item"]
    │       ├── button.value-item_header[data-accordion="trigger"]
    │       ├── .value-item_content[data-accordion="content"]
    │       └── .values_media
    │           ├── image
    │           └── .values_media-content
    │               └── .values_media-content-inner
    └── .values_media-stage
```

Each `.value-item` will contain a complete `.values_media` subcomponent. The top-level `.values_media-stage` will be an empty mount created in Webflow for the generated desktop media stack.

The module will create a `.values_media-index` element inside each `.values_media-content-inner`; editors do not provide index text.

## Module Boundary

Create `src/modules/values.js` and export:

```js
initValues(root = document, gsap = globalThis.gsap)
```

Register it after `accordions` in `src/modules/index.js`. The initializer returns a cleanup function, matching the repository's module convention.

`accordions.js` remains unchanged. The Values module consumes only the accordion's public DOM state: `.value-item.is-open`.

## Responsive Lifecycle

The desktop query is `(min-width: 768px)`, matching the project's existing 767px mobile boundary.

During initial setup, the module:

1. Finds each `.values` component independently.
2. Finds direct Values items belonging to that component.
3. Creates or updates the generated index inside every item-owned `.values_media`.
4. Watches the component for accordion state and item-list changes.
5. Enters either the desktop or mobile lifecycle according to the media query.

### Desktop entry

The module clones every valid item-owned `.values_media` into `.values_media-stage`. The original item media remains in its item and is hidden by responsive CSS. Every generated clone is present simultaneously in the desktop stage, allowing image-to-image crossfades.

The initial active clone corresponds to the currently open item. If no valid item is open, it falls back to the first valid item. This produces the required first-item media on initial load and preserves the selected item when resizing from mobile to desktop.

### Desktop exit

The module kills active media tweens and removes only the generated desktop clones. It does not move or recreate the original item-owned media, so mobile returns to the authored DOM structure immediately.

### Item-list changes

If CMS rendering inserts, removes, or reorders Values items, the module regenerates indices. While desktop is active, it rebuilds the clone stack and preserves the active item where possible. A newly added item does not become active merely because it was inserted.

## State and Crossfade

A component-scoped `MutationObserver` watches `.value-item` class changes and child-list changes. When an item gains `.is-open`, its desktop clone becomes active. Removing `.is-open` does not clear the stage; the most recently selected media remains visible when an open accordion item is closed.

The crossfade uses the global GSAP object:

- outgoing clone: `autoAlpha: 0`
- incoming clone: `autoAlpha: 1`
- duration: 0.4 seconds
- ease: `power2.out`
- overwrite active tweens to keep rapid selection changes safe

The module adds `.is-active` to the current desktop clone for CSS hooks. It removes the class from the previous clone.

When `prefers-reduced-motion: reduce` matches, the duration is zero. Initial desktop rendering is also immediate rather than animated.

## Generated Indices

For each item, the module creates or updates:

```html
<div class="values_media-index">01 / 03</div>
```

Both numbers are padded to at least two digits. The total and position are recalculated after item-list changes. Because the desktop media cards are cloned after index generation, their index text is copied automatically.

Generated source index elements are marked with `data-values-generated="index"` so module cleanup can remove only elements it owns.

## Accessibility

Item-owned media remains normal authored content on mobile.

On desktop, responsive CSS hides the item-owned media. Generated desktop clones use:

- `aria-hidden="true"` and `inert` while inactive
- `aria-hidden="false"` with `inert` removed while active

This prevents inactive overlaid cards from adding duplicate accessible content or focus targets. The desktop stage itself receives no live-region behavior because changing media is supplementary to the accordion trigger and content already announced through their existing accessibility state.

## Malformed Markup and Dependencies

If GSAP is unavailable, the module warns and returns a no-op cleanup function.

For each `.values` component:

- A missing `.values_media-stage` causes a warning and skips desktop media behavior for that component.
- An item missing its `.values_media` causes one warning and is skipped by the media stack.
- Missing `.values_media-content-inner` does not invalidate the card; the module warns and skips index generation for that card.

Valid components and items continue to work when another component or item is malformed.

## Cleanup and Double Initialization

The module prevents duplicate initialization of the same root. Cleanup:

- removes media-query listeners
- disconnects mutation observers
- kills active GSAP tweens
- removes generated desktop clones
- removes generated source index elements
- removes module-owned state classes and accessibility attributes from generated elements by removing those elements
- releases initialization bookkeeping so the root can be initialized again

DOM removal observed during normal operation receives the same tween and generated-node cleanup before records are discarded.

## CSS Contract

JavaScript owns state and animation; Webflow CSS owns layout.

Required authored behavior:

- Mobile through 767px: `.values_media-stage` hidden; `.value-item > .values_media` displayed in the open accordion content layout.
- Desktop from 768px: `.value-item > .values_media` hidden; `.values_media-stage` displayed and positioned as the right-hand stage.
- Generated direct children of `.values_media-stage` overlap in the same stage area so `autoAlpha` can crossfade them.

## Testing

Vitest/jsdom coverage will verify:

- first/open item selection on desktop initialization
- complete media cloning and generated index formatting
- crossfade state after an item gains `.is-open`
- closing the active item leaves its media selected
- rapid changes kill stale tweens
- reduced-motion duration
- desktop-to-mobile destruction and mobile-to-desktop rebuilding
- preservation of the open selection across breakpoint changes
- CMS insertion, removal, and reordering
- multiple Values components remaining isolated
- malformed markup and missing GSAP warnings
- double-initialization protection and full cleanup
- module registration after the accordion initializer
