# Spurwing Webflow project starter

Use this repository for the custom JS of a Webflow project. Add one module for each independent behavior.

The starter keeps source files, generated files, and the loader separate.

## Structure

```text
project/
├── src/
│   ├── index.js             Starts the modules after the DOM is ready.
│   ├── boot.js              Starts each module. A module fault does not stop the next module.
│   └── modules/
│       └── index.js         Lists the modules in their start order.
├── dist/
│   └── bundle.js            Contains the generated production bundle.
├── loader.js                Controls the environment, status panel, and bundle load.
├── dev.mjs                  Builds and serves the local bundle.
├── tag.mjs                  Makes the commit-pinned script tag.
├── vitest.config.js         Sets the test environment.
└── package.json             Defines the commands and development packages.
```

Commit `dist/bundle.js`. The CDN reads this file from GitHub.

Do not commit project notes, reports, exports, or client data. Put these files in `local/`.

## System flow

### Source flow

`src/modules/index.js` contains the module list. `src/index.js` waits for the DOM before it starts this list.

Each module starts in list order. A fault in one module does not stop the next module.

The bundle puts each start function in `window[NAMESPACE].modules`. This interface helps with console checks and content reloads.

### Production flow

1. `npm run build` makes `dist/bundle.js` from `src/index.js`.
2. `npm run tag` makes a script tag for the current commit.
3. Webflow loads `loader.js` from that commit.
4. The loader gets `dist/bundle.js` from the same commit.
5. The browser starts the modules after the DOM is ready.

A commit pin keeps the loader and the bundle together. It also gives each release an immutable CDN address.

## Loader configuration

Edit the `DEFAULTS` block at the start of `loader.js` when you start a project.

| Setting        | Use                                                              |
| -------------- | ---------------------------------------------------------------- |
| `namespace`    | Sets the global object, storage key, and readiness class prefix. |
| `label`        | Sets the title in the development panel.                         |
| `owner`        | Sets the fallback GitHub owner.                                  |
| `project`      | Sets the fallback GitHub repository.                             |
| `commit`       | Sets the fallback Git reference.                                 |
| `environment`  | Sets the default environment. Use `auto`, `local`, or `live`.    |
| `localBase`    | Sets the local server or HTTPS tunnel address.                   |
| `probeTimeout` | Sets the local server check time in milliseconds.                |
| `readyTimeout` | Sets the visibility recovery time in milliseconds.               |

The loader normally gets the owner, repository, and commit from its own script address. It uses `DEFAULTS` if it cannot parse that address.

Change `namespace` to a short project name. For example, use `example` for an Example project.

The loader then creates these interfaces:

```text
window.example.boot
window.example.modules
html.example-loading
html.example-ready
```

`window.example.boot` shows the resolved loader configuration. It also contains the `ready()` function.

The loader also writes `data-project-namespace="example"` to the `html` element. The bundle reads this value before it creates `window.example.modules`.

### Environment and source selection

The loader supports 3 environment values:

| Value   | Result                                                                                |
| ------- | ------------------------------------------------------------------------------------- |
| `auto`  | Checks locally on localhost and Webflow staging. Uses the live bundle on other hosts. |
| `local` | Checks the local server on all hosts. Uses the live bundle if the check fails.        |
| `live`  | Loads the live bundle without a local check.                                          |

A URL environment has priority over a stored panel value. A stored value has priority over `DEFAULTS.environment` in development contexts.

Use `?env=auto`, `?env=local`, or `?env=live` for a page request.

The panel stores its environment value in `sessionStorage`. The value stays in the current tab only.

The loader uses this source logic:

| Environment and context               | Local response | Source       |
| ------------------------------------- | -------------- | ------------ |
| `live`                                | No check       | Live bundle  |
| `local`                               | Success        | Local bundle |
| `local`                               | Failure        | Live bundle  |
| `auto` on localhost or `*.webflow.io` | Success        | Local bundle |
| `auto` on localhost or `*.webflow.io` | Failure        | Live bundle  |
| `auto` on another host                | No check       | Live bundle  |

The local check stops after `probeTimeout`. The default timeout is 900 milliseconds.

If the local check succeeds but the module request fails, the loader requests the live bundle once. It does not repeat a failed live request.

### Development panel

With the default `auto` environment, localhost and Webflow staging show the panel only when the local bundle responds.

If the local bundle does not respond, the loader gets the live bundle. It does not show the panel when no override is active.

Use `?dev=1` to show the panel on another domain. This value also shows a failed local check.

An environment, commit, local URL, or stored environment override also shows the panel. This makes an active override visible.

The panel shows the environment, source, and commit. It also sets the environment and removes stored overrides.

Use `?dev=0` to hide the panel. This value does not change an explicit environment value.

### Commit preview

Use `?commit=SHA` to load `dist/bundle.js` from a specified commit. The value must contain 7 to 40 hexadecimal characters.

The loader file does not change during this preview. The panel shows the selected bundle commit.

### HTML state and visibility recovery

The namespace controls the readiness class names. A namespace of `example` gives these HTML states:

The current defaults use the classes `starter-loading` and `starter-ready`. Change the namespace once when you start a project.

| Event                                 | HTML state                                                    |
| ------------------------------------- | ------------------------------------------------------------- |
| The loader starts                     | Adds `data-project-namespace="example"` and `example-loading` |
| All module start attempts finish      | Adds `data-modules-ready`                                     |
| The bundle finishes its start process | Removes `example-loading` and adds `example-ready`            |
| `readyTimeout` expires                | Removes `example-loading` and adds `example-ready`            |
| The loader does not run               | Adds no state; content stays visible                          |

After a normal start, the HTML element has this state:

```html
<html class="example-ready" data-project-namespace="example" data-modules-ready></html>
```

The default visibility timeout is 4000 milliseconds. It protects the page if the bundle does not load or does not finish.

One module fault does not stop the next module. The bundle still adds `data-modules-ready` and calls `window.example.boot.ready()`.

Gate hidden animation states only on the loading class:

```css
html.example-loading [data-anim] {
	opacity: 0;
}

html.example-ready [data-anim] {
	opacity: 1;
}
```

Do not use the absence of `example-ready` to hide content. Content must stay visible when `example-loading` is absent.

The timeout adds `example-ready` even when the bundle fails. In that case, `data-modules-ready` is absent because the modules did not start.

### Local flow

Run this command:

```bash
npm run dev
```

The server makes a new bundle for each request. It serves the bundle at `http://localhost:5500/bundle.js`.

On localhost and Webflow staging, the loader checks the local server. It uses the live bundle if the local server is off.

Use `?env=local` to make the loader do the local check on another domain. Use `?env=live` to skip the check.

Set `data-local-base` on the loader tag if you use an HTTPS tunnel:

```html
<script
	src="https://cdn.jsdelivr.net/gh/OWNER/REPOSITORY@COMMIT/loader.js"
	data-local-base="https://YOUR-TUNNEL.example"></script>
```

## Start a project

1. Copy the starter files into the new repository.
2. Change the `DEFAULTS` values in `loader.js`.
3. Set the GitHub remote for the new repository.
4. Run `npm install`.
5. Add modules in `src/modules/`.
6. Add each module to `src/modules/index.js`.
7. Add a test next to each module.
8. Run `npm test`.
9. Run `npm run build`.

Create `src/modules/example.js`:

```js
export function initExample(root = document) {
	const elements = root.querySelectorAll("[data-example]");
	for (const element of elements) {
		// Add the module action here.
	}
}
```

Then edit only `src/modules/index.js`. Import the start function and add one descriptor to the array:

```js
import { initExample } from "./example.js";

export const modules = [{ name: "example", init: initExample }];
```

The `name` value becomes the key in `window.example.modules`. The `init` value is the function that the bundle starts.

The example creates this manual start method:

```js
window.example.modules.example();
```

Keep visual values in Webflow or in an Embed. Use modules only for browser behavior.

Use `data-*` attributes as the interface between Webflow, CSS, and JS. Do not use style class names as controls.

## Commands

| Command              | Result                                              |
| -------------------- | --------------------------------------------------- |
| `npm install`        | Installs the development packages.                  |
| `npm run dev`        | Serves a local bundle with an inline source map.    |
| `npm run build`      | Makes the minified production bundle.               |
| `npm test`           | Does all tests once.                                |
| `npm run test:watch` | Does the tests after each file change.              |
| `npm run tag`        | Makes the script tag for the current commit.        |
| `npm run tag -- REF` | Makes the script tag for a specified Git reference. |

## Release

1. Run `npm test`.
2. Run `npm run build`.
3. Commit `src`, `loader.js`, and `dist/bundle.js` together.
4. Push the commit to GitHub.
5. Run `npm run tag`.
6. Put the new tag in the Webflow site settings.
7. Publish the Webflow site.

To go back to an earlier release, make a tag for an earlier commit. Put that tag in Webflow and publish the site.

## Git files

### `.gitignore`

The ignore file excludes installed packages, test coverage, temporary files, local data, environment files, system files, and log files.

The file does not exclude `dist/`. The live site needs the bundle in GitHub.

### `.gitattributes`

The first rule makes Git store text files with LF line endings. Git detects binary files and does not change them.

The second rule tells GitHub that files in `dist/` are generated files. GitHub can exclude these files from language totals.

This rule can also make generated diffs less prominent. It does not change the build or the local files.

## Text rules

Comments and descriptions use the ASD-STE100 rules. Technical names, commands, paths, and code keep their exact forms.
