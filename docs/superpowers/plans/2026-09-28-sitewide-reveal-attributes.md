# Site-wide Reveal Attributes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete a consistent reveal system across in-scope Webflow components and pages, with inherited hero load triggers, composite media targeting, and panel-stack-safe initialization.

**Architecture:** Extend the existing GSAP reveal module rather than creating a second motion system. Apply attributes component-first through Webflow, use dedicated item components for repeated-content targets, and add page-level attributes only for uncovered bespoke content. Record every Webflow mutation and stop before publishing.

**Tech Stack:** JavaScript ES modules, GSAP/ScrollTrigger, Vitest/jsdom, esbuild, Webflow Data tools.

**Spec:** `docs/superpowers/specs/2026-09-28-sitewide-reveal-attributes-design.md`

## Global Constraints

- Include customer-facing static pages, meaningful public CMS templates, and reusable components currently used by them.
- Exclude utility/development pages and dormant experimental components.
- Do not modify Footer component `ab5906ee-95fd-4e08-85ad-89419a2c3a44` or any Footer descendant.
- Do not globally add reveal attributes to Button, Link, Title, or Tag definitions.
- Every in-scope hero uses `data-reveal-trigger="load"`; ordinary sections default to scroll.
- Use the existing values: content `0.9s power4.out`, load `1s power4.out`, media curtain `1.3s power3.inOut`, default stagger `80ms`, total stagger cap `400ms`.
- Splide track/list transforms, arrows, and pagination are not reveal targets.
- Do not publish Webflow.
- Preserve pre-existing working-tree changes in `dist/bundle.js`, `src/modules/index.js`, `src/modules/index.test.js`, `src/modules/insights-toc.js`, and `src/modules/insights-toc.test.js`; stage only task-owned hunks when committing.

## Review Focus

- A nested group inside a load hero must load without creating a ScrollTrigger, unless that nested group explicitly says `scroll`.
- A composite media wrapper must scale only its explicit target or first eligible visual; overlay text must remain unscaled.
- A media reveal with no visual child must still curtain/fade and must never call GSAP with a null target.
- Panel-stack must finish its synchronous clone setup before reveal timelines inspect the generated stage, while remaining after accordions.
- Webflow mutations must never touch Footer, generic primitives, Splide transform-bearing lists/tracks, hidden CMS sources, or utility pages.

---

## File map

- Modify `src/modules/reveals.js`: inherited trigger resolution and composite media target resolution.
- Modify `src/modules/reveals.test.js`: unit coverage for inherited triggers and composite media variants.
- Modify `src/modules/index.js`: move reveal initialization immediately after panel-stack while preserving all current modules.
- Modify `src/modules/index.test.js`: pin the accordion → panel-stack → reveals order.
- Regenerate `dist/bundle.js`: production bundle containing both pre-existing local work and this task's source changes.
- Create `docs/superpowers/reports/2026-09-28-sitewide-reveal-attribute-audit.md`: in-scope inventory, exact mutation ledger, exclusions, and final validation.
- Modify Webflow component definitions and included page/template element trees: data attributes only.

### Task 1: Inherit reveal triggers across nested groups

**Files:**
- Modify: `src/modules/reveals.js`
- Test: `src/modules/reveals.test.js`

**Interfaces:**
- Produces: internal `readTrigger(element: Element): string`, used by grouped and standalone initialization.
- Behavior: own `data-reveal-trigger` wins; otherwise the nearest ancestor reveal group with an explicit trigger wins; otherwise return `scroll`.

- [ ] **Step 1: Add failing nested-trigger tests**

Add tests named:

- `inherits the load trigger for a nested group without an explicit trigger`
- `allows a nested group to override an inherited load trigger with scroll`

The first fixture has a load-triggered outer group and an unqualified inner group; assert both timelines play and `ScrollTrigger.create` is not called. The second adds `data-reveal-trigger="scroll"` to the inner group; assert only the inner group creates a one-time ScrollTrigger.

- [ ] **Step 2: Run the tests and confirm the new assertions fail**

Run: `npm test -- src/modules/reveals.test.js`

Expected: FAIL because the nested group currently defaults to scroll.

- [ ] **Step 3: Implement `readTrigger(element)` and use it in `initGroup` and `initStandalone`**

Resolve the element's own attribute first, then use `element.parentElement?.closest('[data-reveal-group][data-reveal-trigger]')`, then `scroll`. Preserve the existing unknown-trigger warning and scroll fallback.

- [ ] **Step 4: Run the focused reveal tests**

Run: `npm test -- src/modules/reveals.test.js`

Expected: PASS.

- [ ] **Step 5: Commit only Task 1 hunks**

```bash
git add src/modules/reveals.js src/modules/reveals.test.js
git commit -m "feat: inherit nested reveal triggers"
```

### Task 2: Support composite media wrappers

**Files:**
- Modify: `src/modules/reveals.js`
- Test: `src/modules/reveals.test.js`

**Interfaces:**
- Produces: internal `getMediaVisual(element: Element): Element | null`.
- Resolution order: direct media element; descendant `[data-reveal-media-target]`; first descendant `img`, `picture > img`, or `video`; otherwise `null`.
- Consumes: existing `addMediaAnimation` and `clearRevealStyles` media paths.

- [ ] **Step 1: Add failing media-resolution tests**

Add tests named:

- `prefers an explicit media target inside a composite wrapper`
- `finds a nested image without scaling overlay content`
- `supports a nested video as the media visual`
- `curtains and fades a wrapper without adding a scale tween when no visual exists`
- `cleans an explicit composite media target when reduced motion becomes active`

Assert wrapper clip/fade entries remain unchanged, exactly one scale entry targets the resolved visual, overlays are absent from scale entries, and the no-visual case has only two timeline entries.

- [ ] **Step 2: Run the focused tests and confirm failure**

Run: `npm test -- src/modules/reveals.test.js`

Expected: FAIL because the current selector only accepts direct image children and falls back to scaling the wrapper.

- [ ] **Step 3: Implement composite target resolution**

Replace the direct-child selector with separate direct-media, explicit-target, and descendant-visual selectors. In `addMediaAnimation`, add the scale tween only when `getMediaVisual` returns an element. In `clearRevealStyles`, add the resolved visual only when non-null.

- [ ] **Step 4: Run reveal tests**

Run: `npm test -- src/modules/reveals.test.js`

Expected: PASS, including the existing direct-image compatibility test.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/modules/reveals.js src/modules/reveals.test.js
git commit -m "feat: reveal composite media wrappers"
```

### Task 3: Initialize reveals after panel stacks

**Files:**
- Modify: `src/modules/index.js`
- Test: `src/modules/index.test.js`

**Interfaces:**
- Produces module order segment: `accordions` → `panelStack` → `reveals`.
- Preserves: `introOverlay` before `reveals`, current slider/testimonial ordering, and the pre-existing `insightsToc` registration.

- [ ] **Step 1: Extend the module-order test**

Import `initReveals`. Replace the current panel-stack ordering assertion with one that asserts:

- `panelStackIndex === accordionIndex + 1`
- `revealsIndex === panelStackIndex + 1`
- the corresponding registry entries use `initPanelStack` and `initReveals`

- [ ] **Step 2: Run the test and confirm failure**

Run: `npm test -- src/modules/index.test.js`

Expected: FAIL because reveals currently initializes before accordions and panel-stack.

- [ ] **Step 3: Move the existing reveals registry entry immediately after panelStack**

Do not reorder unrelated modules and do not remove the uncommitted `insightsToc` import or registry entry.

- [ ] **Step 4: Run module and reveal tests**

Run: `npm test -- src/modules/index.test.js src/modules/reveals.test.js src/modules/values.test.js`

Expected: PASS.

- [ ] **Step 5: Commit only the ordering hunks if they can be staged without capturing pre-existing insights work**

Use interactive staging. If the task hunk cannot be isolated safely, leave it unstaged and record that in the final report rather than committing unrelated work.

### Task 4: Establish the Webflow inventory and mutation ledger

**Files:**
- Create: `docs/superpowers/reports/2026-09-28-sitewide-reveal-attribute-audit.md`

**Interfaces:**
- Produces a mutation ledger consumed by Tasks 5–7 with columns: scope type, scope/component/page ID, name, element ID, style/display name, before attributes, proposed attributes, reason, and status.
- Consumes Webflow site `6a9eb8468ae40c5a46bd3460` and the component/page scope in the design spec.

- [ ] **Step 1: Record baseline repository verification**

Run the focused suite from Task 3 and `npm test`; record focused results plus any pre-existing unrelated full-suite failures without attempting to fix them.

- [ ] **Step 2: Inventory current reusable definitions in read-only batches**

Use Webflow `get_all_components`, then `get_all_elements` with `scope_component_id` for in-use Sections and dedicated subcomponents. Record existing `data-reveal*`, slots, nested component instances, and interactive attributes.

- [ ] **Step 3: Inventory included static pages and meaningful public CMS templates**

Read page trees in rate-limit-safe batches. Record bespoke reveal gaps and actual slot contents. Exclude utility/dev pages and templates with no public-facing layout.

- [ ] **Step 4: Resolve each proposed mutation before any write**

Populate exact before/after attributes. Reject any row targeting Footer, generic primitives, Splide tracks/lists/arrows/pagination, hidden source collections, form controls, or generated panel-stack clones.

- [ ] **Step 5: Add explicit invariant tables**

List every in-scope hero and its load-trigger state; list Footer as protected; list generic primitive component IDs as protected; list ambiguous slots that will be animated as one wrapper.

- [ ] **Step 6: Commit the read-only audit artifact**

```bash
git add docs/superpowers/reports/2026-09-28-sitewide-reveal-attribute-audit.md
git commit -m "docs: inventory sitewide reveal attributes"
```

### Task 5: Apply shared hero, header, and structural component attributes

**Files:**
- Modify: Webflow component definitions listed in the mutation ledger.
- Update: `docs/superpowers/reports/2026-09-28-sitewide-reveal-attribute-audit.md`

**Interfaces:**
- Consumes approved rows from Task 4.
- Produces normalized shared section definitions inherited by their instances.

- [ ] **Step 1: Apply hero mutations as one batch**

Ensure Home Hero `c138c6b1-12b8-b7be-7ec7-94544850a38c`, Hero `129ae71d-b363-69f7-1053-1411d9fef82f`, Insight Hero `0d19b094-d2d5-3f9c-4fb7-3d0e2a3da450`, and Hero Basic `a47908bb-8f3a-56cf-4403-28d18e400fdd` have root group/load attributes and appropriate fade/up/media child targets. Preserve Home Hero's zero text stagger and 100ms nested media stagger.

- [ ] **Step 2: Re-fetch every changed hero definition**

Verify the actual attribute values and update ledger status to verified. Stop and correct the batch before proceeding if any hero lacks `load`.

- [ ] **Step 3: Apply the Section Header inheritance change**

On Section Header `44f9d5fd-68d4-4efb-3c12-7fed2884f55f`, preserve the group and 90ms stagger, remove explicit `data-reveal-trigger="scroll"`, and retain eyebrow/body/buttons targets. Add a title-region target only if the inventory shows it is not already covered by another owned target.

- [ ] **Step 4: Apply approved 50/50 and structural section mutations**

Normalize section root groups, copy/button `up` targets, background `fade` targets, and visual `media` targets for the shared 50/50, video, image, centered, CTA, and editorial section definitions in the ledger.

- [ ] **Step 5: Re-fetch and verify the batch**

Confirm nearest-group ownership, no duplicate targets, and no Footer or generic primitive mutations. Mark verified rows in the ledger.

### Task 6: Apply repeated-item, slot, slider, and panel-stack attributes

**Files:**
- Modify: Webflow list/slot-bearing components and dedicated subcomponents listed in the ledger.
- Update: `docs/superpowers/reports/2026-09-28-sitewide-reveal-attribute-audit.md`

**Interfaces:**
- Consumes verified slot contents and dedicated child mappings from Task 4.
- Produces capped stagger groups whose targets are dedicated item roots or one ambiguous slot wrapper.

- [ ] **Step 1: Apply dedicated repeated-item roots**

Set approved `up`, `fade`, or `media` values on dedicated roots such as Explore card, Value item, Stats item, Gallery/Team Gallery slide, Service card, Pathway card, Mini card, Team card, Standards card, Application Process item, Journey Panel item, and FAQ item.

- [ ] **Step 2: Apply list and slot group attributes**

Set `data-reveal-group` plus `data-reveal-stagger="80"` or `90` on their stable list/slot wrappers. Animate an ambiguous generic-content slot as one `up` wrapper instead of changing its children globally.

- [ ] **Step 3: Verify every Splide mutation**

Confirm reveal attributes exist only on a stable outer/list-owner group and dedicated slide/card roots. Assert no mutation row targets `.splide__track`, `.splide__list`, arrows, or pagination.

- [ ] **Step 4: Verify Values and other panel stacks**

Confirm item roots are reveal targets, the list/slot owns the stagger, and the stable stage wrapper owns one media reveal. Ensure authored sources and generated clones are not separate targets.

- [ ] **Step 5: Re-fetch each changed definition and update the ledger**

Record exact returned attributes and mark verified only when they match the proposed state.

### Task 7: Apply remaining page/template attributes

**Files:**
- Modify: Included Webflow static page and public CMS-template element trees listed in the ledger.
- Update: `docs/superpowers/reports/2026-09-28-sitewide-reveal-attribute-audit.md`

**Interfaces:**
- Consumes page-specific gap rows from Task 4 after component inheritance is re-evaluated.
- Produces only mutations that cannot be handled by a shared component definition.

- [ ] **Step 1: Re-read included page trees after component changes**

Remove ledger rows already solved through component inheritance.

- [ ] **Step 2: Apply bespoke static-page gaps in small page batches**

Use groups for coherent content regions, media for visual wrappers, and one wrapper target for forms. Do not animate individual fields or controls.

- [ ] **Step 3: Apply meaningful CMS-template gaps**

Cover public editorial headers, bodies, related-content grids, and dedicated cards. Skip hidden collection sources, empty states, and data-only helper elements.

- [ ] **Step 4: Re-fetch each changed page/template**

Verify exact attributes, nearest-group ownership, and that no utility/dev page entered the mutation ledger.

### Task 8: Build, verify, and hand off without publishing

**Files:**
- Regenerate: `dist/bundle.js`
- Update: `docs/superpowers/reports/2026-09-28-sitewide-reveal-attribute-audit.md`

**Interfaces:**
- Consumes all code and Webflow changes.
- Produces a tested bundle and final audit report; does not publish.

- [ ] **Step 1: Run focused tests**

Run: `npm test -- src/modules/reveals.test.js src/modules/index.test.js src/modules/values.test.js`

Expected: PASS.

- [ ] **Step 2: Run the complete suite and compare with baseline**

Run: `npm test`

Expected: no new failures relative to Task 4's baseline. Record any unchanged unrelated failures explicitly.

- [ ] **Step 3: Build the production bundle**

Run: `npm run build`

Expected: successful esbuild output at `dist/bundle.js`. Do not discard the pre-existing insights work included in the generated bundle.

- [ ] **Step 4: Perform automated Webflow invariants**

Re-read changed trees and assert:

- every in-scope hero root is a load group;
- Footer ID is absent from the mutation ledger;
- protected primitives were not mutated;
- slider transform/navigation elements are not reveal targets;
- Section Header has no explicit scroll trigger;
- Values has one stable stage media target and no generated-clone targets.

- [ ] **Step 5: Preview representative page types**

Check Home, one generic Hero page, Values/panel-stack, a Splide card section, a form page, an editorial CMS template, and a long card/list page at desktop and mobile widths. Verify no initial flash, delayed multi-second entry, clipped controls, transform conflict, or duplicate reveal.

- [ ] **Step 6: Finalize the report**

Record code changes, exact Webflow mutation counts, verification results, known unrelated failures, preview observations, and the explicit statement `Webflow publish not performed`.

- [ ] **Step 7: Commit task-owned code/report changes only where safe**

Do not stage unrelated pre-existing work. If `dist/bundle.js` or overlapping index hunks cannot be isolated, leave them uncommitted and call this out in the handoff.
