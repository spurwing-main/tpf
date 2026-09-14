import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDialog, initDialogs, openDialog } from "./dialogs.js";

function modalMarkup() {
	return `
		<button type="button" data-dialog-open="example-dialog">Open modal</button>
		<dialog id="example-dialog" data-modal>
			<div data-modal-surface>
				<button type="button">Inside</button>
			</div>
		</dialog>
	`;
}

describe("dialogs", () => {
	let cleanup;

	beforeEach(() => {
		document.body.innerHTML = modalMarkup();
		document.documentElement.className = "";
		cleanup = null;

		HTMLDialogElement.prototype.showModal = vi.fn(function showModal() {
			this.setAttribute("open", "");
		});
		HTMLDialogElement.prototype.close = vi.fn(function close(returnValue = "") {
			this.returnValue = returnValue;
			this.removeAttribute("open");
			this.dispatchEvent(new Event("close"));
		});
	});

	afterEach(() => cleanup?.());
	afterEach(() => {
		delete HTMLDialogElement.prototype.showModal;
		delete HTMLDialogElement.prototype.close;
		vi.restoreAllMocks();
	});

	it("opens the referenced dialog and locks page scrolling", () => {
		cleanup = initDialogs(document);
		const trigger = document.querySelector("[data-dialog-open]");
		const dialog = document.querySelector("dialog");

		trigger.click();

		expect(dialog.showModal).toHaveBeenCalledOnce();
		expect(dialog.open).toBe(true);
		expect(document.documentElement.classList.contains("dialog-open")).toBe(true);
	});

	it("does not call showModal again when the dialog is already open", () => {
		const dialog = document.querySelector("dialog");

		openDialog(dialog);
		openDialog(dialog);

		expect(dialog.showModal).toHaveBeenCalledOnce();
	});

	it("closes on a backdrop click but not a click inside the dialog surface", () => {
		cleanup = initDialogs(document);
		const dialog = document.querySelector("dialog");
		const surface = document.querySelector("[data-modal-surface]");
		openDialog(dialog);

		surface.click();
		expect(dialog.close).not.toHaveBeenCalled();

		dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
		expect(dialog.close).toHaveBeenCalledWith("backdrop");
	});

	it("unlocks scrolling and restores focus when the dialog closes", () => {
		cleanup = initDialogs(document);
		const trigger = document.querySelector("[data-dialog-open]");
		const dialog = document.querySelector("dialog");
		const focusSpy = vi.spyOn(trigger, "focus");
		trigger.click();

		closeDialog(dialog, "close");

		expect(dialog.returnValue).toBe("close");
		expect(document.documentElement.classList.contains("dialog-open")).toBe(false);
		expect(focusSpy).toHaveBeenCalledOnce();
	});

	it("keeps scrolling locked until every modal dialog is closed", () => {
		document.body.insertAdjacentHTML(
			"beforeend",
			'<dialog id="second-dialog" data-modal></dialog>',
		);
		cleanup = initDialogs(document);
		const [first, second] = document.querySelectorAll("dialog");
		openDialog(first);
		openDialog(second);

		closeDialog(first);
		expect(document.documentElement.classList.contains("dialog-open")).toBe(true);

		closeDialog(second);
		expect(document.documentElement.classList.contains("dialog-open")).toBe(false);
	});

	it("warns and does nothing when a trigger references a missing dialog", () => {
		const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
		document.querySelector("[data-dialog-open]").dataset.dialogOpen = "missing-dialog";
		cleanup = initDialogs(document);

		document.querySelector("[data-dialog-open]").click();

		expect(warning).toHaveBeenCalledWith(
			'[dialogs] No <dialog> found with id "missing-dialog".',
		);
		expect(document.documentElement.classList.contains("dialog-open")).toBe(false);
	});

	it("removes its event handlers and restores the initial scroll-lock class on cleanup", () => {
		document.documentElement.classList.add("dialog-open");
		cleanup = initDialogs(document);
		cleanup();
		cleanup = null;
		const dialog = document.querySelector("dialog");

		document.querySelector("[data-dialog-open]").click();

		expect(dialog.showModal).not.toHaveBeenCalled();
		expect(document.documentElement.classList.contains("dialog-open")).toBe(true);
	});
});
