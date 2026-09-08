const MOBILE_QUERY = "(max-width: 767px)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function restoreAttribute(element, name, value) {
  if (value === null) element.removeAttribute(name);
  else element.setAttribute(name, value);
}

function initNavElement(nav, gsap) {
  const openButton = nav.querySelector('.nav-btn[data-nav-btn="open"]');
  const closeButton = nav.querySelector('.nav-btn[data-nav-btn="close"]');
  const panel = nav.querySelector(".nav_center-item");
  const overlay = nav.querySelector(".nav_overlay");

  if (!openButton || !closeButton || !panel || !overlay) return null;

  const initialExpanded = openButton.getAttribute("aria-expanded");
  const initialHidden = panel.getAttribute("aria-hidden");
  const media = gsap.matchMedia();

  media.add(MOBILE_QUERY, () => {
    const reduceMotion = globalThis.matchMedia?.(REDUCED_MOTION_QUERY).matches;
    const duration = reduceMotion ? 0 : 0.26;
    let isOpen = false;

    gsap.set(panel, { xPercent: 110 });
    gsap.set(overlay, { autoAlpha: 0, pointerEvents: "none" });
    openButton.setAttribute("aria-expanded", "false");
    panel.setAttribute("aria-hidden", "true");

    const timeline = gsap.timeline({
      paused: true,
      defaults: { duration, ease: "power3.out", overwrite: "auto" },
    });

    timeline
      .to(panel, { xPercent: 0 }, 0)
      .to(overlay, { autoAlpha: 1, pointerEvents: "auto" }, 0);

    function open() {
      isOpen = true;
      openButton.setAttribute("aria-expanded", "true");
      panel.setAttribute("aria-hidden", "false");
      timeline.play();
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      openButton.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");
      timeline.reverse();
    }

    function handleKeydown(event) {
      if (event.key === "Escape") close();
    }

    openButton.addEventListener("click", open);
    closeButton.addEventListener("click", close);
    document.addEventListener("keydown", handleKeydown);

    return () => {
      openButton.removeEventListener("click", open);
      closeButton.removeEventListener("click", close);
      document.removeEventListener("keydown", handleKeydown);
      timeline.kill();
      gsap.set([panel, overlay], {
        clearProps: "transform,opacity,visibility,pointer-events",
      });
      restoreAttribute(openButton, "aria-expanded", initialExpanded);
      restoreAttribute(panel, "aria-hidden", initialHidden);
    };
  });

  return media;
}

export function initNav(root = document, gsap = globalThis.gsap) {
  if (!gsap?.set || !gsap?.timeline || !gsap?.matchMedia) return () => {};

  const mediaContexts = [...root.querySelectorAll(".nav")]
    .map((nav) => initNavElement(nav, gsap))
    .filter(Boolean);

  return () => mediaContexts.forEach((media) => media.revert());
}
