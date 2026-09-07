import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const code = readFileSync("loader.js", "utf8");
const loaderSource = "https://cdn.jsdelivr.net/gh/spurwing-main/project-starter@1234567890abcdef/loader.js";

async function runLoader({ source = loaderSource, data = {} } = {}) {
  Object.defineProperty(document, "currentScript", {
    configurable: true,
    value: { src: source, dataset: data },
  });
  window.eval(code);
  for (let step = 0; step < 6; step += 1) await Promise.resolve();
}

describe("loader", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    window.history.replaceState({}, "", "/");
    window.sessionStorage.clear();
    document.querySelectorAll("[data-loader-panel]").forEach((panel) => panel.remove());
    document.head.innerHTML = "";
    document.body.innerHTML = "";
    document.documentElement.className = "";
    delete document.documentElement.dataset.projectNamespace;
    delete window.starter;
  });

  it("loads the bundle from the loader commit", async () => {
    window.history.replaceState({}, "", "/?env=live");
    await runLoader();

    const bundle = document.head.querySelector('script[type="module"]');
    expect(bundle.src).toBe(
      "https://cdn.jsdelivr.net/gh/spurwing-main/project-starter@1234567890abcdef/dist/bundle.js"
    );
    expect(window.starter.boot.commit).toBe("1234567890abcdef");
  });

  it("uses a valid commit override and shows the panel", async () => {
    window.history.replaceState({}, "", "/?dev=1&env=live&commit=abcdef1234567");
    await runLoader();

    const bundle = document.head.querySelector('script[type="module"]');
    expect(bundle.src).toContain("@abcdef1234567/dist/bundle.js");
    expect(document.querySelector("[data-loader-panel]")).not.toBeNull();
    expect(document.querySelector("[data-loader-commit]").textContent).toBe("abcdef1234");
  });

  it("shows content after the ready timeout", async () => {
    vi.useFakeTimers();
    window.history.replaceState({}, "", "/?env=live");
    await runLoader();

    expect(document.documentElement.classList.contains("starter-loading")).toBe(true);
    vi.advanceTimersByTime(4000);
    expect(document.documentElement.classList.contains("starter-ready")).toBe(true);
    expect(document.documentElement.classList.contains("starter-loading")).toBe(false);
  });

  it("uses the live bundle if the local module load fails", async () => {
    window.history.replaceState({}, "", "/?env=local");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await runLoader();

    const localBundle = document.head.querySelector('script[type="module"]');
    expect(localBundle.src).toBe("http://localhost:5500/bundle.js");
    localBundle.onerror();

    const bundles = document.head.querySelectorAll('script[type="module"]');
    expect(bundles).toHaveLength(2);
    expect(bundles[1].src).toContain("@1234567890abcdef/dist/bundle.js");
  });

  it("shows the panel on staging when the local server responds", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await runLoader();

    expect(document.head.querySelector('script[type="module"]').src).toBe(
      "http://localhost:5500/bundle.js"
    );
    expect(document.querySelector("[data-loader-panel]")).not.toBeNull();
  });

  it("hides the panel on staging when the local server does not respond", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    await runLoader();

    expect(document.head.querySelector('script[type="module"]').src).toContain(
      "@1234567890abcdef/dist/bundle.js"
    );
    expect(document.querySelector("[data-loader-panel]")).toBeNull();
  });

  it("reads a stored environment on staging", async () => {
    window.sessionStorage.setItem("starter_environment", "live");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await runLoader();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.starter.boot.environment).toBe("live");
    expect(document.querySelector("[data-loader-panel]")).not.toBeNull();
  });
});
