import { beforeEach, describe, expect, it, vi } from "vitest";
import { bootModules } from "./boot.js";

describe("bootModules", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-modules-ready");
  });

  it("starts modules in list order", () => {
    const calls = [];
    const modules = [
      { name: "first", init: () => calls.push("first") },
      { name: "second", init: () => calls.push("second") },
    ];

    bootModules(modules);

    expect(calls).toEqual(["first", "second"]);
    expect(document.documentElement.hasAttribute("data-modules-ready")).toBe(true);
  });

  it("starts the next module after a fault", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const next = vi.fn();
    const modules = [
      { name: "fault", init: () => { throw new Error("fault"); } },
      { name: "next", init: next },
    ];

    bootModules(modules);

    expect(error).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});
