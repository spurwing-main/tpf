# Site-wide reveal attributes design

Date: 2026-09-28

## Objective

Apply a consistent, restrained reveal system across The Professional Fundraiser's customer-facing Webflow pages, meaningful CMS templates, and reusable components currently in use.

The pass must preserve correct existing reveal attributes, make every hero load-triggered, support nested component groups and composite media, and avoid animating the footer. It must stop before publishing.

## Scope

Included:

- Customer-facing static pages.
- Meaningful public CMS templates, such as insights, podcasts, vacancies, charity campaigns, authors, and categories where the template has a public-facing layout.
- Reusable components currently used by those pages or templates.
- Dedicated subcomponents placed in component slots, inferred from component names and verified against current slot contents.
- The small JavaScript changes needed for nested load groups, panel-stack ordering, and composite media targeting.

Excluded:

- Footer and every descendant of the Footer component.
- Style Guide, Changelog, 404, Password, and other utility/development pages.
- Dormant development or animation experiment components that are not used by an included page.
- Publishing the Webflow site.

Webflow does not expose slot restrictions through the available element settings. Slot intent will therefore be inferred conservatively from the slot-bearing component's name, dedicated child-component names, and actual current slot contents.

## Chosen approach

Use a hybrid, component-first rollout:

1. Update shared component definitions so instances inherit a consistent baseline.
2. Apply reveal attributes to dedicated repeated-item subcomponents when their meaning is unambiguous.
3. Review included page and CMS-template trees for bespoke content that is not covered by a shared component.
4. Add page-level attributes only for those remaining gaps.

This avoids the incompleteness of a component-only pass and the duplication of a page-instance-only pass.

## Motion language

The existing reveal system provides the shared motion language and remains the single source of timing and easing values:

| Motion | Duration | Easing | Purpose |
| --- | ---: | --- | --- |
| Standard content entrance | 0.9s | `power4.out` | Soft, decisive text and structural entrance |
| Load entrance | 1s | `power4.out` | Slightly more deliberate first-view entrance |
| Media curtain | 1.3s | `power3.inOut` | Smooth mask movement without an abrupt stop |
| Media opacity/scale | 0.9s | `power4.out` | Settle the visual independently of the curtain |
| Default stagger | 80ms | n/a | Establish order without making later items wait |
| Total stagger cap | 400ms | n/a | Keep long lists responsive |

Attributes may vary trigger, start position, stagger, and exceptional delay. Individual components must not introduce new easing or duration systems.

## Reveal ownership and nesting

The nearest `data-reveal-group` owns each `data-reveal` target. A target must never be played by both an outer and an inner group.

Nested groups without an explicit trigger inherit the nearest ancestor group's trigger. Therefore:

- A Section Header used in a normal section defaults to a scroll reveal.
- The same Section Header nested inside a load-triggered hero becomes a load reveal.
- A nested group may explicitly override the inherited trigger only where there is a documented reason.

The Section Header's redundant explicit `data-reveal-trigger="scroll"` will be removed so that inheritance can work. Standalone groups still default to scroll in JavaScript.

## Component rules

### Heroes

Home Hero, Hero, Insight Hero, Hero Basic, and any other in-scope component whose role is a page hero must have `data-reveal-group` and `data-reveal-trigger="load"` on the hero root.

- Background decoration: `data-reveal="fade"`.
- Text/content regions: `data-reveal="up"`.
- Composite visual: `data-reveal="media"`.
- Generic slotted controls: animate the slot or containing wrapper as one `up` target; do not modify Button, Link, Tag, or Title globally.
- Home Hero retains zero stagger for its text-level group and a separate 100ms load-triggered media group.

### Section headers

The Section Header remains an internal group with a 90ms stagger:

- Eyebrow: `up`.
- Title wrapper or title region: `up` where it is not already covered.
- Body: `up`.
- Buttons slot: `up` as one unit.

Its trigger is inherited, falling back to scroll when it has no ancestor group.

### Split and 50/50 sections

Basic 5050, Quote 5050, Standout 5050, Stacked 5050, background-image 5050, and comparable layouts use a group on the section root.

- Copy region: `up`.
- Buttons region: `up` as one unit.
- Image/video wrapper: `media`.
- Decorative background only: `fade`.

Existing sensible setups are retained. Duplicate targets inside nested Section Headers are removed or avoided.

### Repeated cards and slotted lists

Explore cards, Value items, Stats items, Gallery slides, Team Gallery slides, Service cards, Pathway cards, Mini cards, Team cards, Standards cards, Application Process items, Journey panel items, FAQ items, and similar dedicated children receive their reveal on the dedicated child-component root.

The containing list, slot, track, or slider region receives `data-reveal-group` and normally an 80–90ms stagger. The exact slot contents must be checked before modifying a dedicated child definition.

Generic components are never given a global reveal attribute solely because they appear in a slot.

### Sliders and Splide

Slides may be staggered reveal targets. Splide's translated list, navigation arrows, and pagination are not reveal targets.

- Place the group on the stable slider/list wrapper that is present before Splide initialises.
- Put `data-reveal="up"` or `fade` on dedicated slide/card roots.
- Use `media` only when the whole slide is a genuine visual reveal and its interaction layer will not be clipped incorrectly.
- Do not animate Splide's own transform-bearing track/list.

### Values and other panel stacks

`panelStack` must initialise before reveals so generated stage content exists before its reveal timeline is built.

- Item list or slot: reveal group with a short capped stagger.
- Authored value/service item roots: `up`.
- Generated media stage: one `media` reveal on the stable stage wrapper.
- Generated clones are not separate reveal targets.
- Panel state-change animation remains owned by `panel-stack.js` and is not duplicated by the reveal system.

### Forms and accordions

Forms reveal by structural region rather than field by field. Inputs, radio options, validation messages, submit controls, and frequently operated UI controls are not individually animated.

FAQ and accordion item roots may stagger into view, but opening and closing remain owned by the accordion interaction.

### CMS lists and editorial sections

Articles, Podcasts, Vacancies, related-content grids, and other public collection lists use:

- Existing Section Header or editorial header sequence.
- One group on the grid/list wrapper.
- Dedicated card/item root targets with an 80ms default stagger.

Empty states, hidden source collections, and data-only helper elements do not animate.

### Footer

No reveal attributes will be added to the Footer definition, Footer instances, or Footer descendants. Existing footer attributes will not be changed as part of this task.

## Composite media reveal

`data-reveal="media"` must work on a wrapper containing an image/video plus captions, labels, overlays, or other children.

Target resolution order:

1. A descendant explicitly marked `data-reveal-media-target`.
2. The first descendant `img`, `picture > img`, or `video`.
3. No scale target if no eligible visual exists.

The attributed parent receives curtain clipping and opacity. Only the resolved visual child receives the scale. Overlaid content does not scale. When no visual is found, the parent still receives curtain and fade but no scale animation.

Directly attributed images remain supported.

## Attribute selection

- `data-reveal-group`: establish sequencing ownership.
- `data-reveal="up"`: text, cards, structural content, and grouped controls.
- `data-reveal="fade"`: backgrounds and elements that should not move.
- `data-reveal="media"`: visual wrappers or direct media.
- `data-reveal-trigger="load"`: heroes and first-view sequences only.
- `data-reveal-stagger="80"`: common repeated-content value.
- `data-reveal-stagger="90"`: Section Header and slightly more editorial sequences.
- `data-reveal-stagger="100"`: Home Hero media only unless inspection establishes another exceptional use.
- `data-reveal-start="early"`: unusually tall visual/list sections that should begin before the default threshold.
- `data-reveal-delay`: exceptional choreography only; avoid routine per-item delays.
- `data-reveal-media-target`: opt-in visual target inside a composite media wrapper.

## Implementation sequence

1. Add tests for nested trigger inheritance and composite media target resolution.
2. Update `reveals.js` to implement those behaviours without changing its public attribute vocabulary.
3. Move panel-stack initialisation before reveal initialisation and update the module-order test.
4. Build and run the focused test suite.
5. Inventory current reveal attributes for all included Webflow components and pages.
6. Apply component-definition changes in small, named batches.
7. Apply dedicated subcomponent changes after verifying their actual parents and slots.
8. Apply remaining page/template-specific attributes.
9. Re-read all changed trees and produce an attribute diff.
10. Validate representative pages locally or in preview at desktop and mobile sizes.
11. Confirm every included hero is load-triggered, no Footer element changed, and no target is accidentally owned by two groups.
12. Stop before publishing.

## Validation and failure handling

Automated checks:

- Reveal tests cover nested group ownership, inherited triggers, direct media, composite media, explicit media targets, no-media fallback, stagger caps, reduced motion, and cleanup.
- Module-order tests ensure panel stacks initialise before reveals.
- Production bundle builds successfully.

Webflow checks:

- Record element IDs and before/after attributes for every mutation.
- Re-fetch changed component and page trees after each batch.
- Verify that Footer component ID `ab5906ee-95fd-4e08-85ad-89419a2c3a44` is absent from the mutation log.
- Verify all hero definitions have a load trigger.
- Verify slider navigation and transform-bearing tracks/lists have no reveal target.
- Verify generic Button, Link, Title, and Tag definitions were not globally modified.

If a component's slot intent remains ambiguous after inspecting its name and current contents, animate the slot wrapper as one unit rather than changing the projected child component globally.

## Deliverable

The completed task consists of tested source changes, a rebuilt local bundle, updated Webflow attributes across the approved scope, and a concise change/validation report. The Webflow site remains unpublished for the user to review.
