import { beforeEach, describe, expect, it } from "vitest";
import { initNav } from "./nav.js";

function createGsap({ mobile = true } = {}) {
  const mediaContexts = [];

  function targets(value) {
    return Array.isArray(value) ? value : [value];
  }

  function apply(target, vars) {
    if (vars.clearProps) {
      target.style.removeProperty("transform");
      target.style.removeProperty("opacity");
      target.style.removeProperty("visibility");
      target.style.removeProperty("pointer-events");
    }
    if ("xPercent" in vars) target.style.transform = `translateX(${vars.xPercent}%)`;
    if ("autoAlpha" in vars) {
      target.style.opacity = String(vars.autoAlpha);
      target.style.visibility = vars.autoAlpha === 0 ? "hidden" : "inherit";
    }
    if ("pointerEvents" in vars) target.style.pointerEvents = vars.pointerEvents;
  }

  const gsap = {
    set(value, vars) {
      targets(value).forEach((target) => apply(target, vars));
    },
    timeline() {
      const steps = [];
      const initial = new Map();

      return {
        to(value, vars) {
          for (const target of targets(value)) {
            if (!initial.has(target)) {
              initial.set(target, target.getAttribute("style") || "");
            }
            steps.push([target, vars]);
          }
          return this;
        },
        play() {
          steps.forEach(([target, vars]) => apply(target, vars));
          return this;
        },
        reverse() {
          initial.forEach((style, target) => {
            if (style) target.setAttribute("style", style);
            else target.removeAttribute("style");
          });
          return this;
        },
        kill() {},
      };
    },
    matchMedia() {
      const context = {
        cleanup: null,
        add(query, setup) {
          if (mobile && query === "(max-width: 767px)") this.cleanup = setup();
        },
        revert() {
          this.cleanup?.();
          this.cleanup = null;
        },
      };
      mediaContexts.push(context);
      return context;
    },
    setMobile(value) {
      if (!value) mediaContexts.forEach((context) => context.revert());
    },
  };

  return gsap;
}

function renderNav() {
  document.body.innerHTML = `
    <nav class="nav">
      <button class="nav-btn" data-nav-btn="open">Open</button>
      <div class="nav_center-item">
        <button class="nav-btn" data-nav-btn="close">Close</button>
      </div>
      <div class="nav_overlay"></div>
    </nav>
  `;

  return {
    openButton: document.querySelector('[data-nav-btn="open"]'),
    closeButton: document.querySelector('[data-nav-btn="close"]'),
    panel: document.querySelector(".nav_center-item"),
    overlay: document.querySelector(".nav_overlay"),
  };
}

describe("initNav", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("opens and closes the mobile panel from explicit nav button selectors", () => {
    const elements = renderNav();
    const gsap = createGsap();

    initNav(document, gsap);

    expect(elements.panel.style.transform).toBe("translateX(110%)");
    expect(elements.overlay.style.opacity).toBe("0");
    expect(elements.overlay.style.pointerEvents).toBe("none");
    expect(elements.openButton.getAttribute("aria-expanded")).toBe("false");
    expect(elements.panel.getAttribute("aria-hidden")).toBe("true");

    elements.openButton.click();

    expect(elements.panel.style.transform).toBe("translateX(0%)");
    expect(elements.overlay.style.opacity).toBe("1");
    expect(elements.overlay.style.pointerEvents).toBe("auto");
    expect(elements.openButton.getAttribute("aria-expanded")).toBe("true");
    expect(elements.panel.getAttribute("aria-hidden")).toBe("false");

    elements.closeButton.click();

    expect(elements.panel.style.transform).toBe("translateX(110%)");
    expect(elements.overlay.style.opacity).toBe("0");
    expect(elements.overlay.style.pointerEvents).toBe("none");
    expect(elements.openButton.getAttribute("aria-expanded")).toBe("false");
    expect(elements.panel.getAttribute("aria-hidden")).toBe("true");
  });

  it("closes an open mobile nav when Escape is pressed", () => {
    const elements = renderNav();
    const gsap = createGsap();
    initNav(document, gsap);
    elements.openButton.click();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

    expect(elements.panel.style.transform).toBe("translateX(110%)");
    expect(elements.overlay.style.opacity).toBe("0");
    expect(elements.openButton.getAttribute("aria-expanded")).toBe("false");
  });

  it("clears animation styles and state when the viewport leaves mobile", () => {
    const elements = renderNav();
    elements.openButton.setAttribute("aria-expanded", "initial-open");
    elements.panel.setAttribute("aria-hidden", "initial-panel");
    const gsap = createGsap();
    initNav(document, gsap);
    elements.openButton.click();

    gsap.setMobile(false);

    expect(elements.panel.style.transform).toBe("");
    expect(elements.overlay.style.opacity).toBe("");
    expect(elements.overlay.style.visibility).toBe("");
    expect(elements.overlay.style.pointerEvents).toBe("");
    expect(elements.openButton.getAttribute("aria-expanded")).toBe("initial-open");
    expect(elements.panel.getAttribute("aria-hidden")).toBe("initial-panel");
  });

  it("does nothing when GSAP or required nav elements are unavailable", () => {
    const elements = renderNav();
    expect(() => initNav(document, undefined)).not.toThrow();

    document.body.innerHTML = '<nav class="nav"></nav>';
    expect(() => initNav(document, createGsap())).not.toThrow();
    expect(elements.panel.getAttribute("style")).toBeNull();
  });
});
