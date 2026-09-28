const LIST_SELECTOR = ".insight-main_sidebar-list";
const LINK_SELECTOR = ".insight-main_sidebar-link";
const CURRENT_CLASS = "w--current";
const CURRENT_SELECTOR = `${LINK_SELECTOR}.${CURRENT_CLASS}`;

function classValueContains(value, className) {
	return value?.split(/\s+/).includes(className) ?? false;
}

function setupInsightsToc(list) {
	if (list.hasAttribute("data-insights-toc-ready")) return;
	list.setAttribute("data-insights-toc-ready", "");

	let lastActiveLink = null;

	function persistActiveLink(link) {
		list.querySelectorAll(LINK_SELECTOR).forEach((candidate) => {
			candidate.toggleAttribute("data-insights-toc-current", candidate === link);
		});
	}

	function positionIndicator(link) {
		if (!link?.isConnected || !list.contains(link)) return;

		const listRect = list.getBoundingClientRect();
		const linkRect = link.getBoundingClientRect();
		const top = linkRect.top - listRect.top - list.clientTop + list.scrollTop;

		list.style.setProperty("--insights-toc-t", `${top}px`);
		list.style.setProperty("--insights-toc-h", `${linkRect.height}px`);
		persistActiveLink(link);
		lastActiveLink = link;
	}

	function updateFromCurrent(records = []) {
		const changedCurrent = Array.from(records)
			.reverse()
			.find(
				(record) =>
					record.target.matches?.(CURRENT_SELECTOR) &&
					!classValueContains(record.oldValue, CURRENT_CLASS),
			)?.target;
		const persistentCurrent =
			lastActiveLink?.isConnected &&
			list.contains(lastActiveLink) &&
			lastActiveLink.matches(CURRENT_SELECTOR)
				? lastActiveLink
				: null;
		const current = changedCurrent || persistentCurrent || list.querySelector(CURRENT_SELECTOR);

		if (!current) return;
		positionIndicator(current);
	}

	const mutationObserver = new MutationObserver(updateFromCurrent);
	mutationObserver.observe(list, {
		subtree: true,
		attributes: true,
		attributeFilter: ["class"],
		attributeOldValue: true,
	});

	if (typeof ResizeObserver !== "undefined") {
		const resizeObserver = new ResizeObserver(() => {
			if (lastActiveLink?.isConnected) positionIndicator(lastActiveLink);
			else updateFromCurrent();
		});
		resizeObserver.observe(list);
		list.querySelectorAll(LINK_SELECTOR).forEach((link) => resizeObserver.observe(link));
	}

	const initialLink = list.querySelector(CURRENT_SELECTOR) || list.querySelector(LINK_SELECTOR);
	if (initialLink) positionIndicator(initialLink);
}

export function initInsightsToc(root = document) {
	root.querySelectorAll(LIST_SELECTOR).forEach(setupInsightsToc);
}

export default initInsightsToc;
