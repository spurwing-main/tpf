const DIALOG_SELECTOR = "dialog[data-modal]";
const TRIGGER_SELECTOR = "[data-dialog-open]";
const SCROLL_LOCK_CLASS = "dialog-open";

const initializedRoots = new WeakMap();
const openerByDialog = new WeakMap();

function getOwnerDocument(root) {
	return root.nodeType === 9 ? root : root.ownerDocument;
}

function isDialog(element) {
	const Dialog = element?.ownerDocument?.defaultView?.HTMLDialogElement;
	return Boolean(Dialog && element instanceof Dialog);
}

function syncScrollLock(ownerDocument) {
	const hasOpenDialog = Boolean(ownerDocument.querySelector(`${DIALOG_SELECTOR}[open]`));
	ownerDocument.documentElement.classList.toggle(SCROLL_LOCK_CLASS, hasOpenDialog);
}

function findDialog(ownerDocument, id) {
	const dialog = id ? ownerDocument.getElementById(id) : null;

	if (!isDialog(dialog) || !dialog.matches(DIALOG_SELECTOR)) {
		console.warn(`[dialogs] No <dialog> found with id "${id || ""}".`);
		return null;
	}

	return dialog;
}

export function openDialog(dialog, opener = dialog?.ownerDocument?.activeElement) {
	if (!isDialog(dialog) || dialog.open) return;

	if (opener instanceof dialog.ownerDocument.defaultView.HTMLElement) {
		openerByDialog.set(dialog, opener);
	}

	dialog.showModal();
	syncScrollLock(dialog.ownerDocument);
}

export function closeDialog(dialog, returnValue = "close") {
	if (!isDialog(dialog) || !dialog.open) return;

	dialog.close(returnValue);
	syncScrollLock(dialog.ownerDocument);
}

export function initDialogs(root = document) {
	const existingCleanup = initializedRoots.get(root);
	if (existingCleanup) return existingCleanup;

	const ownerDocument = getOwnerDocument(root);
	const documentElement = ownerDocument.documentElement;
	const initiallyScrollLocked = documentElement.classList.contains(SCROLL_LOCK_CLASS);

	function handleClick(event) {
		const trigger = event.target.closest?.(TRIGGER_SELECTOR);

		if (trigger) {
			const dialog = findDialog(ownerDocument, trigger.dataset.dialogOpen);
			if (dialog) openDialog(dialog, trigger);
			return;
		}

		if (
			isDialog(event.target) &&
			event.target.matches(DIALOG_SELECTOR) &&
			event.target.open
		) {
			closeDialog(event.target, "backdrop");
		}
	}

	function handleClose(event) {
		const dialog = event.target;
		if (!isDialog(dialog) || !dialog.matches(DIALOG_SELECTOR)) return;

		syncScrollLock(ownerDocument);
		const opener = openerByDialog.get(dialog);

		if (opener?.isConnected) opener.focus();
		openerByDialog.delete(dialog);
	}

	root.addEventListener("click", handleClick);
	root.addEventListener("close", handleClose, true);
	syncScrollLock(ownerDocument);

	const cleanup = () => {
		root.removeEventListener("click", handleClick);
		root.removeEventListener("close", handleClose, true);
		documentElement.classList.toggle(SCROLL_LOCK_CLASS, initiallyScrollLocked);
		initializedRoots.delete(root);
	};

	initializedRoots.set(root, cleanup);
	return cleanup;
}
