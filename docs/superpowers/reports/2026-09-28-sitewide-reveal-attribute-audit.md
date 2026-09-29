# Site-wide reveal attribute audit

Date: 2026-09-28

Site: `6a9eb8468ae40c5a46bd3460`

Status: component mutation rollout complete; 63 saved attribute changes across 49 verified ledger rows; two unsupported component-instance targets intentionally skipped; no publish performed.

## Repository baseline

- Focused reveal/module/panel-stack suite: 57/57 passing before Webflow writes.
- Full suite baseline: 197/209 passing before implementation.
- Known pre-existing failures: loader (4), nav-scroll (3), nav (3), stats (1), testimonials (1).
- After Tasks 1–2 added seven reveal tests, the full suite remained at the same 12 failures with 204/216 passing.

## Scope

Included static pages:

- Home
- Story
- Partnerships
- Fundraisers
- Backstage
- Journal
- Summer Heroes Programme
- Sustainability
- Terms and Conditions / Terms & Conditions
- Privacy Policy
- Making a Complaint / Complaints
- Newsletter Sign-up Success
- Success - Contact
- Success page - Application

Included public CMS templates where the template contains a meaningful public layout:

- Insights

Excluded:

- 404, Password, Style Guide, and Changelog utility/development pages.
- Client logos, Testimonials, Instagram posts, and Videos raw collection templates unless page-tree inspection establishes a public standalone layout.
- Dormant Dev and Animation component experiments.
- Empty or one-node page trees returned for Themes, Charity Campaigns, Vacancies, Podcasts, Authors, and Insight Categories templates, plus the legacy Contact and TPF Podcast pages.
- Footer and every Footer descendant.

## Protected targets

| Target | ID | Rule |
| --- | --- | --- |
| Footer | `ab5906ee-95fd-4e08-85ad-89419a2c3a44` | No mutation |
| Button | `03aa808e-2b5d-7df7-94b1-c50bc7002be1` | No global reveal attribute |
| Link | `4d178a33-53a9-ac21-b286-5e48685dcc0b` | No global reveal attribute |
| Title | `591a0c50-c7d2-83af-4015-1b5a8f9d5631` | No global reveal attribute |
| Tag | `33c1c049-4fd1-eb29-25ff-cf767eb894df` | No global reveal attribute |
| Splide track/list, arrows, pagination | n/a | Never a reveal target |
| Hidden CMS sources / empty states | n/a | Never a reveal target |
| Form inputs and controls | n/a | Never individually animated |

## Hero invariant

| Component | ID | Root state before rollout | Proposed state | Status |
| --- | --- | --- | --- | --- |
| Home hero | `c138c6b1-12b8-b7be-7ec7-94544850a38c` | group; trigger `load`; stagger `0` | Preserve; media subgroup stagger `100` | Verified before |
| Hero | `129ae71d-b363-69f7-1053-1411d9fef82f` | group; trigger `load` | Preserve | Verified before |
| Insight Hero | `0d19b094-d2d5-3f9c-4fb7-3d0e2a3da450` | group; trigger `load` | Preserve | Verified before |
| Hero Basic | `a47908bb-8f3a-56cf-4403-28d18e400fdd` | group; trigger `load` | Preserve | Verified before |

## Verified existing component patterns

| Component | Current state | Initial ruling |
| --- | --- | --- |
| Basic 5050 | Root group; content `up`; media wrapper `media`; mobile buttons `up` | Preserve |
| Quote 5050 | Root group; body/buttons `up`; media `fade` | Change the composite image/overlay wrapper to `media` |
| Explore | Root group; nested slider group on `.splide`; slot is `.splide__list` | Keep group off transform-bearing list; preserve outer slider group |
| Explore card | Dedicated root `fade` | Preserve |
| Section Header | Root group; explicit `scroll`; stagger `90`; eyebrow/body/buttons `up`; Title instance unanimated | Remove explicit `scroll`; animate the local Title instance `up` |
| Values | Root/content/list groups; item slot stagger `90`; stage `media`; buttons `up` | Preserve after Section Header inheritance; panel-stack now initializes first |
| Value item | Dedicated root `up` | Preserve |
| Stats | Root group; stats slot group | Preserve; default stagger is already `80` |
| Stats item | Dedicated root `fade` | Preserve |
| Testimonials | Root group; stable panel `fade` | Preserve; no slide/track mutation |
| Home hero | Correct load hierarchy and media subgroup | Preserve |
| Hero | Correct load root; background `fade`; content `up` | Preserve; inspect tags slot as one wrapper only if needed |
| Stacked 5050 / Item | Root group; media `media`; content `up` | Preserve |
| Stacked 5050 | Root group; item slot unqualified | Preserve; dedicated items own internal groups |
| Large video | Root group; stable media wrapper `media` | Preserve |
| Instagram slider | Root group; authored slide content `media` | Preserve; do not target track/list/arrows |
| Insight card | Internal group with several targets including media | Preserve |

## Ambiguous slot policy

Slot restrictions are not exposed by Webflow element settings. Dedicated slots whose current contents are consistently named item/card components may receive a group and stagger. Slots that accept generic Button, Link, Title, Tag, or mixed content will be animated as one wrapper target rather than changing the projected component definition.

## Mutation ledger

Every row was populated from a read-only component-tree fetch before writing. `Before` and `After` contain only attributes changed by this rollout.

| Scope | Scope ID | Name | Element ID | Style/display name | Before | After | Reason | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Component | `44f9d5fd-68d4-4efb-3c12-7fed2884f55f` | Section Header | `44f9d5fd-68d4-4efb-3c12-7fed2884f55f` | `section-header` | `data-reveal-trigger=scroll` | attribute removed | Allow nested hero groups to inherit `load`; standalone default remains scroll | Verified |
| Component | `44f9d5fd-68d4-4efb-3c12-7fed2884f55f` | Section Header | `591a0c50-c7d2-83af-4015-1b5a8f9d5630` | `Title` instance | — | `data-reveal=up` | Webflow rejects custom attributes on ComponentInstance nodes; the global Title primitive remains untouched | Not applied |
| Component | `bb378f4e-ca70-4443-6f3b-88c802fbcde0` | Quote 5050 | `bb378f4e-ca70-4443-6f3b-88c802fbcdeb` | `quote-5050_media` | `data-reveal=fade` | `data-reveal=media` | Use the composite curtain treatment; only the image scales while overlay content remains unscaled | Verified |
| Component | `eb6aa95a-c568-21c0-906e-71a3f184c6f1` | Standout video | `eb6aa95a-c568-21c0-906e-71a3f184c6f1` | `standout-video` | — | `data-reveal-group` | Coordinate text and media from a stable section wrapper | Verified |
| Component | `eb6aa95a-c568-21c0-906e-71a3f184c6f1` | Standout video | `e8afcf9d-0df1-645d-0c1b-1bedcd7804ea` | `standout-video_content` | — | `data-reveal=up` | Reveal the text as one restrained unit | Verified |
| Component | `eb6aa95a-c568-21c0-906e-71a3f184c6f1` | Standout video | `eb6aa95a-c568-21c0-906e-71a3f184c6f5` | `standout-video_media` | — | `data-reveal=media` | Curtain the full video wrapper while scaling only its image | Verified |
| Component | `b145d5e6-9b9b-33db-df19-0ae6293d1339` | Gallery | `7f3db7ee-c4be-376e-d429-3acf9412a71f` | `gallery_slider` | Splide attrs only | add `data-reveal-group`; `data-reveal-stagger=80` | Stagger slide components from the stable slider root | Verified |
| Component | `13f21ff7-4266-d2b9-d1a3-18e39ac6c9ea` | Gallery slide | `13f21ff7-4266-d2b9-d1a3-18e39ac6c9ea` | `gallery_slider-item.square-img` | — | `data-reveal=media` | Apply the image-only curtain reveal to each authored slide | Verified |
| Component | `1d0e8ba9-f1e6-ed75-2804-07bffd9ef70c` | FAQ | `5e0ac809-5f32-8e7c-a052-e27c6dee8605` | `faq_list` slot | — | `data-reveal-group`; `data-reveal-stagger=80` | Stagger dedicated FAQ items without touching accordion controls | Verified |
| Component | `b237299d-6ba3-8d57-eec3-fc729a1df691` | FAQ item | `b237299d-6ba3-8d57-eec3-fc729a1df691` | `faq-item` | accordion attr only | add `data-reveal=up` | Reveal each complete interactive item as a unit | Verified |
| Component | `bed24224-3e72-ff20-c5f7-ad4f4dfc1a86` | Team gallery | `bed24224-3e72-ff20-c5f7-ad4f4dfc1a92` | `team-gallery_slider` | Splide attrs only | add `data-reveal-group`; `data-reveal-stagger=80` | Stagger slides from the stable slider root | Verified |
| Component | `4537147c-6ee6-39fa-3d0d-3c29802f7369` | Team gallery slide | `4537147c-6ee6-39fa-3d0d-3c29802f7369` | `team-gallery-slide` | — | `data-reveal=up` | Keep image and caption together while avoiding track transforms | Verified |
| Component | `296b466c-7df1-e72c-dc8d-5bf1905aaba0` | Services | `718fc745-7230-3987-25e2-9c3caf21c2db` | `services_items` slot | panel-stack/accordion attrs | add `data-reveal-group`; `data-reveal-stagger=80` | Stagger service rows after panel-stack setup | Verified |
| Component | `fd22c43b-4c84-22fb-4413-3045f938fb3c` | Service card | `fd22c43b-4c84-22fb-4413-3045f938fb3c` | `service-item` | panel-stack/accordion attrs | add `data-reveal=up` | Reveal each accordion row as a unit | Verified |
| Component | `fd22c43b-4c84-22fb-4413-3045f938fb3c` | Service card | `1fc9734d-73b6-aaef-632c-64342b672e77` | `services-panel_media` | — | `data-reveal=media` | The panel-stack clone exists before reveals initialize, so the staged visual receives the curtain safely | Verified |
| Component | `bb079bba-c381-5bc7-44ce-12d40e83044b` | Pathways / Slider | `bb079bba-c381-5bc7-44ce-12d40e830450` | `pathways_slider` | Splide attrs only | add `data-reveal-group`; `data-reveal-stagger=80` | Stagger cards without mutating the track/list | Verified |
| Component | `f67281d4-3a8e-eee8-6ece-45b6fcfaf91e` | Pathways card | `f67281d4-3a8e-eee8-6ece-45b6fcfaf91e` | `pathways-card` | — | `data-reveal=up` | Reveal each full card as a single interactive unit | Verified |
| Component | `af19bd7b-d924-f32f-e538-9005b525fab6` | Pathways / Static | `7569b914-5b65-425a-6510-e47ba52392d6` | `pathways_list.is-static` slot | — | `data-reveal-group`; `data-reveal-stagger=80` | Stagger the dedicated Contract card slot | Verified |
| Component | `bf94544b-66d4-c0df-00a3-7056268eff02` | Contract card | `bf94544b-66d4-c0df-00a3-7056268eff02` | `contract-card` | — | `data-reveal=up` | Reveal each full contract card as one unit | Verified |
| Component | `824a258c-6a6e-7426-33b0-36d2a4b1697f` | Mini cards | `824a258c-6a6e-7426-33b0-36d2a4b1697f` | `mini-cards` | `data-reveal=fade` | attribute removed | Eliminate the double section fade; Section Header and Mini cards inner already own their reveals | Verified |
| Component | `175e37dd-d4e0-12a5-51e9-0955ae625687` | Multi-video | `498552de-4499-aa1c-ce4c-6adc453e908f` | desktop CMS list | — | `data-reveal-group`; `data-reveal-stagger=80` | Stagger the visible desktop card collection | Verified |
| Component | `175e37dd-d4e0-12a5-51e9-0955ae625687` | Multi-video | `97a561d0-6f4d-a5a8-8ff3-72bc7aaf811f` | stacked CMS list | — | `data-reveal-group`; `data-reveal-stagger=80` | Stagger the visible stacked card collection independently | Verified |
| Component | `407856b4-02d1-d10d-a6e0-a70c6d9d7e3c` | Video card | `407856b4-02d1-d10d-a6e0-a70c6d9d7e3c` | `video-card` | video attr only | add `data-reveal=media` | Curtain the composite card while scaling only its poster image | Verified |
| Component | `1133321b-08a7-c83a-bb20-d6171d91ae00` | Full width image | `1133321b-08a7-c83a-bb20-d6171d91ae00` | `full-width-img` | — | `data-reveal=media` | Apply the standard image curtain | Verified |
| Component | `22a55ff3-381c-68d3-1d01-ddaa730f853f` | 5050 with background image | `22a55ff3-381c-68d3-1d01-ddaa730f853f` | `bg-5050` | — | `data-reveal-group` | Coordinate the background with the nested Section Header | Verified |
| Component | `22a55ff3-381c-68d3-1d01-ddaa730f853f` | 5050 with background image | `33643e9f-35cd-7067-ff0c-026e0ad6ee06` | `bg-5050_bg` | — | `data-reveal=media` | Curtain the image/overlay wrapper while scaling only the image | Verified |
| Component | `1e0d5eb6-4878-5fd8-54f0-3c7bcab17cfc` | Teams slider | `1e0d5eb6-4878-5fd8-54f0-3c7bcab17cfc` | `teams` | — | `data-reveal-group` | Own the section footer while nested groups own header and slider | Verified |
| Component | `1e0d5eb6-4878-5fd8-54f0-3c7bcab17cfc` | Teams slider | `1e0d5eb6-4878-5fd8-54f0-3c7bcab17d00` | `teams_slider` | Splide attrs only | add `data-reveal-group`; `data-reveal-stagger=80` | Stagger cards from the stable slider root | Verified |
| Component | `1e0d5eb6-4878-5fd8-54f0-3c7bcab17cfc` | Teams slider | `46bb101b-9785-80c3-212c-b7579d98de2b` | `teams_footer` | — | `data-reveal=up` | Reveal the section CTA without changing Button globally | Verified |
| Component | `33fec593-9a0c-7d4e-9f0b-cc7f9f548773` | Teams card | `33fec593-9a0c-7d4e-9f0b-cc7f9f548773` | `teams-card` | — | `data-reveal=up` | Keep card image and copy together | Verified |
| Component | `58e1eb1b-9bb9-2d59-7004-1e88b84cc759` | Standards | `58e1eb1b-9bb9-2d59-7004-1e88b84cc759` | `standards` | — | `data-reveal-group` | Coordinate the background while nested groups own header and cards | Verified |
| Component | `58e1eb1b-9bb9-2d59-7004-1e88b84cc759` | Standards | `6631a205-da63-b930-377c-c6b85b61ff9b` | `standards_bg` | — | `data-reveal=media` | Curtain image and overlay; scale only the image | Verified |
| Component | `58e1eb1b-9bb9-2d59-7004-1e88b84cc759` | Standards | `6bb23779-fe01-e493-e165-ffdece595e1d` | `standards_list` slot | — | `data-reveal-group`; `data-reveal-stagger=80` | Stagger dedicated Standards cards | Verified |
| Component | `e1b4d500-9961-b2b8-8e47-9129be7f561a` | Standards card | `e1b4d500-9961-b2b8-8e47-9129be7f561a` | `standards-card` | — | `data-reveal=up` | Reveal each complete card | Verified |
| Component | `d5f70900-2c04-abb1-4f56-bf74a3cc2805` | Vacancies | `fdc772e4-f421-6839-54db-7e3faff093ef` | vacancy CMS list | — | `data-reveal-group`; `data-reveal-stagger=80` | Stagger vacancy cards without touching CMS wrappers or empty state | Verified |
| Component | `d5f70900-2c04-abb1-4f56-bf74a3cc2805` | Vacancies | `1acf96a3-f763-d661-3aca-6aa122bbca7e` | `vacancy-item` | hover attr only | add `data-reveal=up` | Reveal each complete linked vacancy card | Verified |
| Component | `b4890d14-4c56-0d99-6945-9ef2ca04518f` | CTA panel | `b4890d14-4c56-0d99-6945-9ef2ca04518f` | `cta-panel` | — | `data-reveal=up` | Reveal the composite panel as one unit | Verified |
| Component | `a363e45f-43c3-72c1-bb6b-bd03d170ecbc` | Application process | `15262cb2-ef17-2c4f-535d-6d066c71f382` | `apply-process_intro` slot | — | `data-reveal-group`; `data-reveal-stagger=80` | Stagger dedicated process items | Verified |
| Component | `3bd62c15-b047-17f9-db5a-f8ff4488eaa2` | Application process / Item | `3bd62c15-b047-17f9-db5a-f8ff4488eaa2` | `apply-card` | — | `data-reveal=up` | Reveal each process step as one unit | Verified |
| Component | `1c94649c-873c-a2bb-3516-701404d3b209` | Application form | `aca77a5b-49c8-2d8d-a21d-b76d2b1a3c9e` | `apply-form_form` | existing form attrs | add `data-reveal=up` | Reveal the visible form once; never animate individual controls | Verified |
| Component | `af9c5ec5-b182-8b49-98e0-02071fa4e5b0` | Summer Heroes Application Form | `af9c5ec5-b182-8b49-98e0-02071fa4e5b5` | `apply-form_form` | existing form attrs | add `data-reveal=up` | Match the standard application form treatment | Verified |
| Component | `7ced5e40-35f4-28d0-e5f8-a6014a98b1f8` | Articles | `e85eca2d-206e-8094-241e-593c4c3aac4c` | `Title` instance | — | `data-reveal=up` | Same unsupported ComponentInstance limitation as Section Header; wrapping the heading would be a structural change | Not applied |
| Component | `da149aaa-ea01-28a6-9a7b-39ee24b7f269` | Podcasts | `da149aaa-ea01-28a6-9a7b-39ee24b7f269` | `podcasts` | — | `data-reveal-group` | Own the latest feature and footer while nested groups own header/list | Verified |
| Component | `da149aaa-ea01-28a6-9a7b-39ee24b7f269` | Podcasts | `6dc7cee1-0f8f-33ef-08b5-81f3487530b1` | podcast CMS list | — | `data-reveal-group`; `data-reveal-stagger=80` | Stagger podcast rows | Verified |
| Component | `da149aaa-ea01-28a6-9a7b-39ee24b7f269` | Podcasts | `4f065017-3caa-becb-2329-99e1d95637aa` | `podcast-item` | — | `data-reveal=up` | Reveal each linked row as one unit | Verified |
| Component | `da149aaa-ea01-28a6-9a7b-39ee24b7f269` | Podcasts | `d2296abc-734d-0135-5e1f-5132747a19da` | `podcast-latest` | Ken Burns attr only | add `data-reveal=media` | Curtain the composite feature while scaling only its image | Verified |
| Component | `da149aaa-ea01-28a6-9a7b-39ee24b7f269` | Podcasts | `4bb1b5e9-c3c6-7cc4-4952-d72347d05ed7` | `podcasts_footer` | — | `data-reveal=up` | Reveal CTA/addendum as one unit | Verified |
| Component | `89a5b5db-d47e-940e-34a5-92a091c195b0` | Quote | `89a5b5db-d47e-940e-34a5-92a091c195b0` | `quote` | — | `data-reveal=up` | Give inline editorial quotes a restrained entrance | Verified |
| Component | `5c41f9b2-87b4-49eb-6bf1-b33e4d7086e5` | Legal body | `5c41f9b2-87b4-49eb-6bf1-b33e4d7086e7` | `legal-body_layout` | — | `data-reveal-group`; `data-reveal-stagger=80` | Coordinate only the label and reading body | Verified |
| Component | `5c41f9b2-87b4-49eb-6bf1-b33e4d7086e5` | Legal body | `5c41f9b2-87b4-49eb-6bf1-b33e4d7086e8` | legal eyebrow | — | `data-reveal=up` | Introduce the section label | Verified |
| Component | `5c41f9b2-87b4-49eb-6bf1-b33e4d7086e5` | Legal body | `5c41f9b2-87b4-49eb-6bf1-b33e4d7086ea` | legal rich text | — | `data-reveal=fade` | Avoid moving a long reading surface | Verified |

## Webflow write invariants

- Only rows recorded in the ledger may be written.
- After each batch, re-fetch every changed tree and mark its rows `Verified` only when returned attributes match.
- Footer ID must never appear in this ledger.
- Protected primitive IDs must never appear in this ledger.
- No Webflow publish action is permitted.

## Page/template re-evaluation

- All included static pages inherit the required coverage from the verified component definitions; no page-local writes were needed.
- The Insights template already has a load-owned main region and a scroll-owned related-content region. Nested related-card groups now inherit the intended trigger through the updated reveal module, so no template-local write was needed.
- Empty/one-node templates remained excluded.

## Rollout result

- Verified component mutation rows: 49, representing 63 individual saved attribute changes.
- Unsupported, intentionally unapplied component-instance targets: 2 (Section Header Title and Articles Title).
- Footer mutations: 0.
- Generic primitive definition mutations: 0.
- Page/template-local mutations: 0.
- Hero roots re-read after rollout: Home Hero, Hero, Insight Hero, and Hero Basic all retain `data-reveal-group` plus `data-reveal-trigger=load`.
- Section Header re-read after rollout: group and `90` stagger retained; explicit trigger absent.
- Slider safety re-read after rollout: Gallery, Team Gallery, Pathways, and Teams tracks/lists contain only Splide classes and no reveal attributes.
- Values re-read after rollout: root group retained; item list owns `90` stagger; stable stage owns the single authored `media` target; Value item root remains `up`.
- Focused verification after rollout: 57/57 passing across reveals, module order, and Values.
- Full-suite verification after rollout: 204/216 passing with the same 12 pre-existing failures (loader 4, nav-scroll 3, nav 3, stats 1, testimonials 1); no new failure category.
- Production bundle regenerated successfully with esbuild (`dist/bundle.js`, 201.5 kB).
- Visual preview of the new Webflow attributes was not available on the public staging URL because publishing was intentionally withheld; exact saved attributes were re-read through Webflow instead.
- Webflow publish not performed.
