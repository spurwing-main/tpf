export function bootModules(modules, root = document) {
  for (const module of modules) {
    try {
      module.init(root);
    } catch (error) {
      console.error(`[site] ${module.name} did not start.`, error);
    }
  }

  root.documentElement?.setAttribute("data-modules-ready", "");
}
