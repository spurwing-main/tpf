(() => {
	"use strict";

	// Edit this block when you start a project.
	const DEFAULTS = Object.freeze({
		namespace: "tpf",
		label: "TPF JS",
		owner: "spurwing-main",
		project: "tpf",
		commit: "main",
		environment: "auto",
		localBase: "http://localhost:5500",
		probeTimeout: 900,
		readyTimeout: 4000,
	});

	const root = document.documentElement;
	const params = new URLSearchParams(location.search);
	const script = document.currentScript;
	const namespace = DEFAULTS.namespace;
	const readyClass = `${namespace}-ready`;
	const loadingClass = `${namespace}-loading`;
	const storageKey = `${namespace}_environment`;

	if (!/^[a-z][a-z0-9-]*$/.test(namespace)) {
		console.error("[loader] DEFAULTS.namespace is not valid.");
		return;
	}

	const project = (window[namespace] = window[namespace] || {});
	root.dataset.projectNamespace = namespace;
	root.classList.remove(readyClass);
	root.classList.add(loadingClass);

	let readyTimer;
	const setReady = () => {
		window.clearTimeout(readyTimer);
		root.classList.remove(loadingClass);
		root.classList.add(readyClass);
	};
	readyTimer = window.setTimeout(setReady, DEFAULTS.readyTimeout);

	const getParam = (name) => {
		const value = params.get(name);
		return value?.trim() || null;
	};

	const getFlag = (name) => {
		if (!params.has(name)) return null;
		const value = (params.get(name) || "").trim();
		if (!value || /^(1|true|dev|on|yes)$/i.test(value)) return true;
		if (/^(0|false|live|off|no)$/i.test(value)) return false;
		return null;
	};

	const store = {
		get() {
			try {
				return sessionStorage.getItem(storageKey);
			} catch {
				return null;
			}
		},
		set(value) {
			try {
				sessionStorage.setItem(storageKey, value);
			} catch {}
		},
		clear() {
			try {
				sessionStorage.removeItem(storageKey);
			} catch {}
		},
	};

	const self = (() => {
		const source = script?.src || "";
		const match = source.match(/\/gh\/([^/]+)\/([^@/]+)@([^/]+)\/(?:.*\/)?loader\.js/);
		return match ? { owner: match[1], project: match[2], commit: match[3] } : null;
	})();

	const commitParam = getParam("commit");
	const commitOverride = commitParam && /^[0-9a-f]{7,40}$/i.test(commitParam) ? commitParam : null;
	if (commitParam && !commitOverride) {
		console.warn("[loader] The commit value must be a Git commit SHA.");
	}

	const owner = self?.owner || DEFAULTS.owner;
	const repository = self?.project || DEFAULTS.project;
	const commit = commitOverride || self?.commit || DEFAULTS.commit;
	const localBase = (getParam("local") || script?.dataset.localBase || DEFAULTS.localBase).replace(
		/\/$/,
		"",
	);
	const localUrl = `${localBase}/bundle.js`;
	const liveUrl = `https://cdn.jsdelivr.net/gh/${owner}/${repository}@${commit}/dist/bundle.js`;
	const isDevHost = location.hostname === "localhost" || location.hostname.endsWith(".webflow.io");
	const devFlag = getFlag("dev") ?? getFlag("mode");
	const devMode = devFlag === false ? false : devFlag === true || isDevHost;
	const requestedEnvironment = getParam("env");
	const storedEnvironment = devMode ? store.get() : null;
	const environment = ["auto", "local", "live"].includes(
		requestedEnvironment || storedEnvironment || DEFAULTS.environment,
	)
		? requestedEnvironment || storedEnvironment || DEFAULTS.environment
		: DEFAULTS.environment;
	const hasOverride = Boolean(
		requestedEnvironment || commitOverride || getParam("local") || storedEnvironment,
	);

	project.boot = {
		namespace,
		owner,
		project: repository,
		commit,
		environment,
		localBase,
		localUrl,
		liveUrl,
		devMode,
		ready: setReady,
	};

	async function localIsAvailable() {
		const controller = new AbortController();
		const timeout = window.setTimeout(() => controller.abort(), DEFAULTS.probeTimeout);

		try {
			const response = await fetch(localUrl, {
				cache: "no-store",
				mode: "cors",
				signal: controller.signal,
			});
			return response.ok;
		} catch {
			return false;
		} finally {
			window.clearTimeout(timeout);
		}
	}

	async function getSource() {
		if (environment === "live") return { url: liveUrl, kind: "live", localUp: null };
		if (environment === "auto" && !devMode) {
			return { url: liveUrl, kind: "live", localUp: null };
		}

		const localUp = await localIsAvailable();
		if (localUp) return { url: localUrl, kind: "local", localUp: true };
		if (environment === "local") {
			console.warn(
				"[loader] The local bundle is not available. The loader will use the live bundle.",
			);
		}
		return { url: liveUrl, kind: "live", localUp: false };
	}

	function inject(source, canFallback = true) {
		const bundle = document.createElement("script");
		bundle.type = "module";
		bundle.src = source.url;
		bundle.onload = () => {
			console.log(`[${namespace}] JS bundle loaded`, {
				environment,
				source: source.kind,
				url: source.url,
				commit,
			});
		};
		bundle.onerror = () => {
			console.error("[loader] The bundle did not load.", source.url);
			if (source.kind === "local" && canFallback) {
				inject({ url: liveUrl, kind: "live", localUp: false }, false);
			}
		};
		document.head.appendChild(bundle);
	}

	function mountPanel(source) {
		if (document.querySelector("[data-loader-panel]")) return;

		const style = document.createElement("style");
		style.textContent = `
      [data-loader-panel]{position:fixed;left:16px;bottom:16px;z-index:2147483647;width:232px;
        box-sizing:border-box;padding:12px;color:#eef0f5;background:rgba(18,20,28,.9);
        border:1px solid rgba(255,255,255,.12);border-radius:12px;box-shadow:0 8px 30px rgba(0,0,0,.35);
        font:500 12px/1.4 system-ui,sans-serif;backdrop-filter:blur(12px)}
      [data-loader-panel] *{box-sizing:border-box}
      [data-loader-head]{display:flex;align-items:center;gap:8px;margin-bottom:10px}
      [data-loader-dot]{width:9px;height:9px;border-radius:50%;background:#4c8dff}
      [data-loader-dot][data-state="local"]{background:#37d67a}
      [data-loader-dot][data-state="down"]{background:#f5a623}
      [data-loader-title]{flex:1;font-weight:700}
      [data-loader-close]{border:0;padding:2px 4px;color:inherit;background:transparent;cursor:pointer}
      [data-loader-options]{display:flex;padding:3px;margin-bottom:10px;background:rgba(255,255,255,.07);border-radius:9px}
      [data-loader-options] button{flex:1;border:0;padding:6px;color:#c4c8d4;background:transparent;border-radius:7px;
        font:inherit;font-weight:600;cursor:pointer}
      [data-loader-options] button[aria-pressed="true"]{color:#fff;background:rgba(255,255,255,.16)}
      [data-loader-meta]{display:grid;grid-template-columns:auto 1fr;gap:3px 8px;color:#9da3b2;font-size:11px}
      [data-loader-meta] b{overflow:hidden;color:#eef0f5;text-overflow:ellipsis;white-space:nowrap}
      [data-loader-reset]{margin-top:10px;border:1px solid rgba(255,255,255,.14);padding:4px 8px;color:inherit;
        background:rgba(255,255,255,.07);border-radius:6px;font:inherit;cursor:pointer}
    `;
		document.head.appendChild(style);

		const panel = document.createElement("div");
		panel.setAttribute("data-loader-panel", "");
		panel.innerHTML = `
      <div data-loader-head>
        <span data-loader-dot></span>
        <span data-loader-title></span>
        <button data-loader-close type="button" aria-label="Close">×</button>
      </div>
      <div data-loader-options>
        <button data-environment="local" type="button">Local</button>
        <button data-environment="auto" type="button">Auto</button>
        <button data-environment="live" type="button">Live</button>
      </div>
      <div data-loader-meta>
        <span>Status</span><b data-loader-status></b>
        <span>Source</span><b data-loader-source></b>
        <span>Commit</span><b data-loader-commit></b>
      </div>
      <button data-loader-reset type="button">Reset overrides</button>
    `;

		const state = source.kind === "local" ? "local" : source.localUp === false ? "down" : "live";
		const status =
			source.kind === "local"
				? "Local connected"
				: source.localUp === false
					? "Local unavailable"
					: "Live";
		panel.querySelector("[data-loader-dot]").dataset.state = state;
		panel.querySelector("[data-loader-title]").textContent = DEFAULTS.label;
		panel.querySelector("[data-loader-status]").textContent = status;
		panel.querySelector("[data-loader-source]").textContent =
			source.kind === "local" ? localBase : "jsDelivr";
		panel.querySelector("[data-loader-commit]").textContent = commit.slice(0, 10);

		panel.querySelectorAll("[data-environment]").forEach((button) => {
			const value = button.dataset.environment;
			button.setAttribute("aria-pressed", String(value === environment));
			button.addEventListener("click", () => {
				store.set(value);
				const url = new URL(location.href);
				url.searchParams.delete("env");
				location.href = url.toString();
			});
		});

		panel.querySelector("[data-loader-reset]").addEventListener("click", () => {
			store.clear();
			const url = new URL(location.href);
			["env", "commit", "local", "dev", "mode"].forEach((name) => url.searchParams.delete(name));
			location.href = url.toString();
		});
		panel.querySelector("[data-loader-close]").addEventListener("click", () => panel.remove());
		root.appendChild(panel);
	}

	getSource().then((source) => {
		inject(source);
		const showPanel =
			devFlag !== false && (devFlag === true || hasOverride || source.localUp === true);
		if (showPanel) mountPanel(source);
	});
})();
