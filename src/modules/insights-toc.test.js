import { beforeEach, describe, expect, it, vi } from "vitest";
import { initInsightsToc } from "./insights-toc.js";

const LIST_SELECTOR = ".insight-main_sidebar-list";
const LINK_SELECTOR = ".insight-main_sidebar-link";

class ResizeObserverStub {
	static instances = [];

	constructor(callback) {
		this.callback = callback;
		ResizeObserverStub.instances.push(this);
	}

	observe() {}

	trigger() {
		this.callback([]);
	}
}

function setRect(element, { top, height }) {
	element.getBoundingClientRect = () => ({
		top,
		height,
		bottom: top + height,
		left: 0,
		right: 0,
		width: 0,
		x: 0,
		y: top,
		toJSON() {},
	});
}

function renderToc() {
	document.body.innerHTML = `
		<nav class="insight-main_sidebar-list">
			<a class="insight-main_sidebar-link w--current" href="#first">First heading</a>
			<a class="insight-main_sidebar-link" href="#second">Second heading</a>
		</nav>
	`;

	const list = document.querySelector(LIST_SELECTOR);
	const links = [...document.querySelectorAll(LINK_SELECTOR)];
	Object.defineProperty(list, "clientTop", { configurable: true, value: 2 });
	Object.defineProperty(list, "scrollTop", { configurable: true, value: 6, writable: true });
	setRect(list, { top: 100, height: 100 });
	setRect(links[0], { top: 120, height: 24 });
	setRect(links[1], { top: 152, height: 40 });
	return { list, links };
}

async function flushMutations() {
	await Promise.resolve();
}

describe("initInsightsToc", () => {
	beforeEach(() => {
		ResizeObserverStub.instances = [];
		vi.stubGlobal("ResizeObserver", ResizeObserverStub);
		document.body.innerHTML = "";
	});

	it("positions the indicator on the initial Finsweet current link", () => {
		const { list, links } = renderToc();

		initInsightsToc(document);

		expect(list.style.getPropertyValue("--insights-toc-t")).toBe("24px");
		expect(list.style.getPropertyValue("--insights-toc-h")).toBe("24px");
		expect(links[0].hasAttribute("data-insights-toc-current")).toBe(true);
		expect(links[1].hasAttribute("data-insights-toc-current")).toBe(false);
	});

	it("highlights the first link on page load when Finsweet has no current link", () => {
		const { list, links } = renderToc();
		links[0].classList.remove("w--current");

		initInsightsToc(document);

		expect(list.style.getPropertyValue("--insights-toc-t")).toBe("24px");
		expect(list.style.getPropertyValue("--insights-toc-h")).toBe("24px");
		expect(links[0].hasAttribute("data-insights-toc-current")).toBe(true);
		expect(links[1].hasAttribute("data-insights-toc-current")).toBe(false);
	});

	it("uses the most recently changed current link during a handover", async () => {
		const { list, links } = renderToc();
		initInsightsToc(document);

		links[1].classList.add("w--current");
		await flushMutations();

		expect(list.style.getPropertyValue("--insights-toc-t")).toBe("56px");
		expect(list.style.getPropertyValue("--insights-toc-h")).toBe("40px");
		expect(links[0].hasAttribute("data-insights-toc-current")).toBe(false);
		expect(links[1].hasAttribute("data-insights-toc-current")).toBe(true);
	});

	it("prefers a newly current link over a later unrelated class change", async () => {
		const { list, links } = renderToc();
		initInsightsToc(document);

		links[1].classList.add("w--current");
		links[0].classList.add("is-visible");
		await flushMutations();

		expect(list.style.getPropertyValue("--insights-toc-t")).toBe("56px");
		expect(list.style.getPropertyValue("--insights-toc-h")).toBe("40px");
		expect(links[0].hasAttribute("data-insights-toc-current")).toBe(false);
		expect(links[1].hasAttribute("data-insights-toc-current")).toBe(true);
	});

	it("keeps the last active link through a later unrelated class change", async () => {
		const { list, links } = renderToc();
		initInsightsToc(document);

		links[1].classList.add("w--current");
		await flushMutations();
		links[0].classList.add("is-visible");
		await flushMutations();

		expect(list.style.getPropertyValue("--insights-toc-t")).toBe("56px");
		expect(list.style.getPropertyValue("--insights-toc-h")).toBe("40px");
		expect(links[0].hasAttribute("data-insights-toc-current")).toBe(false);
		expect(links[1].hasAttribute("data-insights-toc-current")).toBe(true);
	});

	it("preserves the last indicator state while no link is current", async () => {
		const { list, links } = renderToc();
		initInsightsToc(document);

		links[0].classList.remove("w--current");
		await flushMutations();

		expect(list.style.getPropertyValue("--insights-toc-t")).toBe("24px");
		expect(list.style.getPropertyValue("--insights-toc-h")).toBe("24px");
		expect(links[0].hasAttribute("data-insights-toc-current")).toBe(true);
	});

	it("repositions the indicator when the active link reflows", () => {
		const { list, links } = renderToc();
		initInsightsToc(document);
		setRect(links[0], { top: 130, height: 48 });

		ResizeObserverStub.instances[0].trigger();

		expect(list.style.getPropertyValue("--insights-toc-t")).toBe("34px");
		expect(list.style.getPropertyValue("--insights-toc-h")).toBe("48px");
	});

	it("does nothing when the page has no insights table of contents", () => {
		document.body.innerHTML = "<main>Article</main>";

		expect(() => initInsightsToc(document)).not.toThrow();
	});

	it.each([
		"",
		'<nav class="insight-main_sidebar-list"></nav>',
	])("applies the no-toc variant when there are no TOC links (%s)", (content) => {
		document.body.innerHTML = `<main class="insight-main">${content}</main>`;

		initInsightsToc(document);

		expect(document.querySelector(".insight-main").getAttribute("data-wf--insight-main--variant"))
			.toBe("no-toc");
	});

	it("preserves the existing variant when a TOC exists", () => {
		renderToc();
		document.body.innerHTML = `<main class="insight-main" data-wf--insight-main--variant="default">${document.body.innerHTML}</main>`;

		initInsightsToc(document);

		expect(document.querySelector(".insight-main").getAttribute("data-wf--insight-main--variant"))
			.toBe("default");
	});

	it("updates the variant when TOC links are generated or removed later", async () => {
		document.body.innerHTML = '<main class="insight-main"><nav class="insight-main_sidebar-list"></nav></main>';
		const main = document.querySelector(".insight-main");
		const list = main.querySelector(LIST_SELECTOR);
		initInsightsToc(document);

		list.innerHTML = '<a class="insight-main_sidebar-link" href="#first">First heading</a>';
		await flushMutations();
		expect(main.hasAttribute("data-wf--insight-main--variant")).toBe(false);

		list.replaceChildren();
		await flushMutations();
		expect(main.getAttribute("data-wf--insight-main--variant")).toBe("no-toc");
	});

	it("initializes each list only once", () => {
		const { list } = renderToc();

		initInsightsToc(document);
		initInsightsToc(document);

		expect(list.hasAttribute("data-insights-toc-ready")).toBe(true);
		expect(ResizeObserverStub.instances).toHaveLength(1);
	});
});
