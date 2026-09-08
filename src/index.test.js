import { beforeEach, describe, expect, it, vi } from "vitest";

const { bootModules } = vi.hoisted(() => ({
  bootModules: vi.fn(),
}));

vi.mock("./boot.js", () => ({ bootModules }));
vi.mock("./modules/index.js", () => ({
  modules: [{ name: "example", init: vi.fn() }],
}));

describe("site entry", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    bootModules.mockClear();
    document.documentElement.dataset.projectNamespace = "starter";
    delete window.starter;
  });

  it("logs when all module start attempts finish", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    await import("./index.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));

    expect(log).toHaveBeenCalledWith("[starter] JS ready", {
      modules: ["example"],
    });
  });
});
