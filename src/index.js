import { bootModules } from "./boot.js";
import { modules } from "./modules/index.js";

const namespace = document.documentElement.dataset.projectNamespace || "starter";
const project = (window[namespace] = window[namespace] || {});
project.modules = Object.fromEntries(modules.map((module) => [module.name, module.init]));

function start() {
  bootModules(modules);
  if (typeof project.boot?.ready === "function") {
    project.boot.ready();
  } else {
    document.documentElement.classList.add(`${namespace}-ready`);
  }
  console.log(`[${namespace}] JS ready`, {
    modules: Object.keys(project.modules),
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
