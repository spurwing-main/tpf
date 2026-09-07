# Development SOP

## Project set up 🟢

### Webflow

- Duplicate the WF starter project.
- Change the project name and site details.

### GitHub and local files

- Use the `project-starter` template to create a public GitHub repository for the project.
- Clone the new repo to the local development directory.
- Put private notes, reports, exports, and client data in `local/`.

### JS configuration

- Edit the `DEFAULTS` block in `loader.js`.
- Set a short project namespace and a clear panel label.
- Set the GitHub owner, repo name, and fallback commit.
- Set `localBase` if the project uses an HTTPS tunnel.

### First build

- Run `npm install`.
- Run `npm test` if the project has tests.
- Run `npm run build`.
- Commit `src/`, `loader.js`, and `dist/bundle.js` together.
- Push the commit to GitHub.
- Run `npm run tag`.
- Put the generated tag in the Webflow site-wide head code.

## CSS 🟡

### Class types 🟢

Use our variant of Client First throughout:

#### Component class

- A custom class created for a specific component, page, grouping of elements, or single element.
- E.g. `.section-header`, `.section-header_content`, `.button_text` etc

#### Utility class

- A class with a specific purpose (e.g. adding a colour)
- E.g. `.u-text-color-red`, `.u-display-contents`, `.u-hide-mbl`

#### Text class

- A class that applies a specific text style
- E.g. `.text-eyebrow`, `.text-rich-text`, `.text-title-l`, `.text-link`

#### Core layout classes

- Similar to a utility class, but used for specific structural or layout purposes
- E.g. `.container`, `.page-wrap`, `.main-wrap`

#### Modifier classes

- To modify another class (normally component or text class, rarely layout, never utility)
- E.g. `.button.is-blue`, `.text-eyebrow.has-underline`

### Other guidance

- Store utility classes, text classes and other classes added in non-standard methods (e.g. via JS, in custom embeds, via attributes) in a hidden style storage WF element.
- Generally, don't stack classes too deeply. It is a balance between class management in the Webflow GUI and duplication of styles in CSS.

### Custom CSS storage 🟡

- Place all custom CSS in the global Custom Code component
- Split CSS out into appropriate separate embeds

### Core structure

```html
<body>
    <div class="page-wrap">
        <header class="header"></div>
        <main class="main-wrap">
            <section class="some-section" id="">
                <div class="container">
                    ...
                </div>
            </section>
        </main>
        <footer></footer>
    </div>
</body>
```

## JS 🟢

- Module structure
  - Put one independent behavior in each file under `src/modules/`.
  - Export an `initName(root = document)` function from each module.
  - Import the function in `src/modules/index.js`.
  - Add `{ name: "name", init: initName }` to the `modules` array.
  - Use the array order to control the module start order.
  - Add shared utilities only when 2 or more modules need them.
- DOM contract
  - Use `data-*` attributes to connect Webflow, CSS, and JS.
  - Keep visual values in Webflow or CSS.
  - Use JS only for browser behavior and state changes.
- Local development
  - Run `npm run dev` to serve the local bundle on port 5500.
  - Open the Webflow staging site.
  - Confirm that the development panel shows `Local connected`.
- Visibility fallback
  - Gate hidden animation states on `html.NAMESPACE-loading` only.
  - Use `html.NAMESPACE-ready` for the ready state.
  - Keep content visible when the loading class is absent.
  - Do a check of the `readyTimeout` fallback before release.
- Tests and builds
  - Tests are optional.
  - Add tests for complex or high-risk modules.
  - If tests exist, run `npm test` before release.
  - Run `npm run build` before each commit.
  - Do not edit `dist/bundle.js` directly.
  - Commit the source files and generated bundle together.
- Release
  - Push the release commit to GitHub.
  - Run `npm run tag`.
  - Replace the Webflow loader tag with the new commit-pinned tag.
  - Publish Webflow.

## Naming conventions

### General rules

- Name based on function, not current content or context.
  - e.g. `card`, `layout`, `grid`, `panel`
- Use suitably generic naming where it is likely a style or component will be used in another context.
  - e.g. use `data-accordion-` `attributes for an FAQ component if it is likely that the same open/close animation will be repurposed for other accordion-type elements.
- Use standard abbreviations:
  - `dsk`, `tab`, `mbl`, `mbp` for the 4x Webflow breakpoints
  - `btn` - button
  - `2xs`, `xl`, `lg`, `md`, `sm`, `xs`, `2xs` for sizing
  - `lh` - line height
  - `ls` - letter spacing
  - `fs` - font size
  - `ff` - font family
  - `bg` - background
  - `w` - width
  - `h` - height
  - `t` - top
  - `l` - left
  - `b` - bottom
  - `r` - right
  - `p` - padding
  - `m` - margin
- Use Americanizations where appropriate to avoid confusion with CSS properties - e.g. `color`

## Styles and variables

- rich text
- titles
- colors, themes

## Components

- component naming and organisation
- field naming and organisation
- standard fields and options
  - id
  - visibility

## Specific components

### Accordions

### Carousels

## Launch

## Post launch

- Duplicate site and transfer to SPW workspace
- Transfer GH repo to client account

---

---

## TO ADD:

- offer basic JS siteFunctions approach as an alternative to full repo approach
- Launch checklist
- Qs to discuss:
  - .section- namespace
  - .text-title or just .title- namespace
