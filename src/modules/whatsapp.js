const WHATSAPP_SELECTOR = "[data-whatsapp]";
const PHONE_PATTERN = /^[1-9]\d{6,14}$/;
const initializedRoots = new WeakMap();

function getWhatsappElements(root) {
	const elements = [...root.querySelectorAll(WHATSAPP_SELECTOR)];

	if (root.nodeType === 1 && root.matches(WHATSAPP_SELECTOR)) {
		elements.unshift(root);
	}

	return elements;
}

function normalizePhoneNumber(value) {
	if (!value || !/^\d+$/.test(value)) return null;

	const number = value.startsWith("00") ? value.slice(2) : value;
	return PHONE_PATTERN.test(number) ? number : null;
}

function getWhatsappUrl(element) {
	const number = normalizePhoneNumber(element.getAttribute("data-whatsapp-number"));
	const message = element.getAttribute("data-whatsapp-message");

	if (!number || !message) {
		console.warn(
			"[whatsapp] Invalid configuration. Add an international digits-only data-whatsapp-number and a data-whatsapp-message.",
		);
		return null;
	}

	return `https://api.whatsapp.com/send?phone=${number}&text=${encodeURIComponent(message)}`;
}

export function initWhatsapp(root = document) {
	const existingCleanup = initializedRoots.get(root);
	if (existingCleanup) return existingCleanup;

	const ownerWindow = root.nodeType === 9 ? root.defaultView : root.ownerDocument?.defaultView;
	const elements = getWhatsappElements(root);

	function handleClick(event) {
		const url = getWhatsappUrl(event.currentTarget);
		if (!url || !ownerWindow?.open) return;

		ownerWindow.open(url, "_blank", "noopener");
	}

	elements.forEach((element) => element.addEventListener("click", handleClick));

	const cleanup = () => {
		elements.forEach((element) => element.removeEventListener("click", handleClick));
		initializedRoots.delete(root);
	};

	initializedRoots.set(root, cleanup);
	return cleanup;
}
