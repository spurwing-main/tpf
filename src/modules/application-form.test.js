import { beforeEach, describe, expect, it, vi } from "vitest";
import { initApplicationForms, loadGoogleMaps } from "./application-form.js";

function applicationMarkup() {
	return `
		<section class="apply" data-apply-form>
			<form data-google-maps-api-key="demo-key" data-apply-role-value="General application">
				<h2>Apply for this role</h2>
				<div data-apply-address>
					<input data-apply-address-search type="search" name="Search Address" />
					<button type="button" data-apply-address-manual-trigger>Enter address manually</button>
					<div data-apply-address-fields>
						<input data-apply-address-field="line1" />
						<input data-apply-address-field="line2" />
						<input data-apply-address-field="line3" />
						<input data-apply-address-field="town" />
						<input data-apply-address-field="county" />
						<input data-apply-address-field="postcode" />
					</div>
					<p data-apply-address-status aria-live="polite"></p>
				</div>
				<select data-apply-select name="Where did you hear?"><option value="">Select one</option></select>
				<div data-apply-option-source>
					<div data-apply-option data-value="Friend">A friend</div>
					<div data-apply-option>Social media</div>
				</div>
				<fieldset data-apply-campaign-group>
					<legend>Preferred campaigns</legend>
					<input type="hidden" data-apply-campaign-output name="Preferred Charity Campaigns" />
					<p data-apply-campaign-message aria-live="polite"></p>
					<div data-apply-campaign-list>
						<div class="w-dyn-list">
							<div role="list" class="w-dyn-items">
								<div role="listitem" class="w-dyn-item">
									<div data-apply-campaign-option>
										<input type="checkbox" name="Preferred Charity Campaigns" value="Environmental Conservation" />
									</div>
								</div>
								<div role="listitem" class="w-dyn-item">
									<div data-apply-campaign-option>
										<input type="checkbox" name="Preferred Charity Campaigns" value="Mental Health Awareness" />
									</div>
								</div>
							</div>
						</div>
					</div>
				</fieldset>
				<textarea data-apply-cover-note></textarea>
				<input type="hidden" data-apply-role />
				<input type="hidden" data-apply-page-url />
			</form>
		</section>
	`;
}

class FakePlaceAutocompleteElement extends HTMLElement {
	static instances = [];

	constructor(options) {
		super();
		this.options = options;
		this.value = "";
		FakePlaceAutocompleteElement.instances.push(this);
	}

	select(place) {
		this.value = place.formattedAddress || "";
		const event = new Event("gmp-select");
		Object.defineProperty(event, "placePrediction", {
			value: { toPlace: () => place },
		});
		this.dispatchEvent(event);
	}

	fail() {
		this.dispatchEvent(new Event("gmp-error"));
	}
}

customElements.define("fake-place-autocomplete", FakePlaceAutocompleteElement);

describe("initApplicationForms", () => {
	beforeEach(() => {
		document.body.innerHTML = applicationMarkup();
		FakePlaceAutocompleteElement.instances = [];
		delete globalThis.google;
		vi.restoreAllMocks();
		Object.defineProperty(window, "location", {
			configurable: true,
			value: { href: "https://example.com/apply" },
		});
	});

	it("hydrates editable Webflow sources, metadata, and the auto-growing cover note", () => {
		const textarea = document.querySelector("[data-apply-cover-note]");
		Object.defineProperty(textarea, "scrollHeight", { configurable: true, value: 120 });

		initApplicationForms(document, {
			loadGoogleMaps: vi
				.fn()
				.mockResolvedValue({ places: { PlaceAutocompleteElement: FakePlaceAutocompleteElement } }),
		});

		const select = document.querySelector("[data-apply-select]");
		expect([...select.options].map((option) => [option.value, option.textContent])).toEqual([
			["", "Select one"],
			["Friend", "A friend"],
			["Social media", "Social media"],
		]);
		expect(document.querySelector("[data-apply-role]").value).toBe("General application");
		expect(document.querySelector("[data-apply-page-url]").value).toBe("https://example.com/apply");
		expect(textarea.style.height).toBe("120px");

		Object.defineProperty(textarea, "scrollHeight", { configurable: true, value: 180 });
		textarea.dispatchEvent(new Event("input", { bubbles: true }));
		expect(textarea.style.height).toBe("180px");
	});

	it("requires one campaign, aggregates selected labels, and caps selections at ten", () => {
		const root = document.querySelector("[data-apply-form]");
		const list = root.querySelector("[data-apply-campaign-list] [role='list']");
		list.insertAdjacentHTML(
				"beforeend",
				`<div role="listitem" class="w-dyn-item">
					<div data-apply-campaign-option>
						<input type="checkbox" name="Preferred Charity Campaigns" value="Disaster Relief" />
					</div>
				</div>`,
			);
		for (let index = 3; index < 11; index += 1) {
			list.insertAdjacentHTML(
				"beforeend",
				`<div role="listitem" class="w-dyn-item">
					<div data-apply-campaign-option>
						<input type="checkbox" name="Preferred Charity Campaigns" value="Campaign ${index}" />
					</div>
				</div>`,
			);
		}

		initApplicationForms(document, {
			loadGoogleMaps: vi
				.fn()
				.mockResolvedValue({ places: { PlaceAutocompleteElement: FakePlaceAutocompleteElement } }),
		});

		const checkboxes = [...root.querySelectorAll('[data-apply-campaign-option] input')];
		const output = root.querySelector("[data-apply-campaign-output]");
		const message = root.querySelector("[data-apply-campaign-message]");
		expect(checkboxes.every((checkbox) => !checkbox.name)).toBe(true);

		const wanted = new Set([
			"Environmental Conservation",
			"Mental Health Awareness",
			"Disaster Relief",
		]);
		checkboxes.forEach((checkbox) => {
			checkbox.checked = wanted.has(checkbox.value);
			checkbox.dispatchEvent(new Event("change", { bubbles: true }));
		});

		const expected =
			"Environmental Conservation, Mental Health Awareness, Disaster Relief";
		const form = root.querySelector("form");
		expect(output.value).toBe(expected);
		expect(checkboxes.every((checkbox) => !checkbox.name)).toBe(true);
		expect(new FormData(form).getAll("Preferred Charity Campaigns")).toEqual([expected]);

		checkboxes.forEach((checkbox) => {
			checkbox.checked = false;
		});
		checkboxes[0].dispatchEvent(new Event("change", { bubbles: true }));
		expect(checkboxes[0].validationMessage).toContain("Select at least one");

		checkboxes[0].checked = true;
		checkboxes[1].checked = true;
		checkboxes[0].dispatchEvent(new Event("change", { bubbles: true }));
		expect(output.value).toBe("Environmental Conservation, Mental Health Awareness");
		expect(checkboxes[0].validationMessage).toBe("");

		checkboxes.slice(2).forEach((checkbox) => {
			checkbox.checked = true;
			checkbox.dispatchEvent(new Event("change", { bubbles: true }));
		});
		expect(checkboxes.filter((checkbox) => checkbox.checked)).toHaveLength(10);
		expect(checkboxes[10].disabled).toBe(true);
		expect(message.textContent).toContain("up to 10");

		checkboxes[0].checked = false;
		checkboxes[0].dispatchEvent(new Event("change", { bubbles: true }));
		expect(checkboxes[10].disabled).toBe(false);
	});

	it("reads role metadata from the nested form attribute", () => {
		initApplicationForms(document, {
			loadGoogleMaps: vi.fn().mockResolvedValue({
				places: { PlaceAutocompleteElement: FakePlaceAutocompleteElement },
			}),
		});

		expect(document.querySelector("[data-apply-role]").value).toBe("General application");
	});

	it("does not use form text when the role attribute is empty", () => {
		const form = document.querySelector("form");
		form.setAttribute("data-apply-role-value", "");

		initApplicationForms(document, {
			loadGoogleMaps: vi.fn().mockResolvedValue({
				places: { PlaceAutocompleteElement: FakePlaceAutocompleteElement },
			}),
		});

		expect(document.querySelector("[data-apply-role]").value).toBe("");
		expect(document.querySelector("[data-apply-role]").value).not.toContain(
			"Apply for this role",
		);
	});

	it("keeps page metadata when role metadata is absent", () => {
		const form = document.querySelector("form");
		form.removeAttribute("data-apply-role-value");

		initApplicationForms(document, {
			loadGoogleMaps: vi.fn().mockResolvedValue({
				places: { PlaceAutocompleteElement: FakePlaceAutocompleteElement },
			}),
		});

		expect(document.querySelector("[data-apply-role]").value).toBe("");
		expect(document.querySelector("[data-apply-page-url]").value).toBe(
			"https://example.com/apply",
		);
	});

	it("reveals and populates editable UK address fields from Google Places", async () => {
		const loadGoogleMaps = vi
			.fn()
			.mockResolvedValue({ places: { PlaceAutocompleteElement: FakePlaceAutocompleteElement } });
		initApplicationForms(document, { loadGoogleMaps });
		await Promise.resolve();

		const address = document.querySelector("[data-apply-address]");
		const search = address.querySelector("[data-apply-address-search]");
		const fields = address.querySelector("[data-apply-address-fields]");
		const autocomplete = FakePlaceAutocompleteElement.instances[0];

		expect(loadGoogleMaps).toHaveBeenCalledWith("demo-key", document);
		expect(autocomplete.options).toEqual({
			includedRegionCodes: ["gb"],
			includedPrimaryTypes: ["street_address"],
			noClearButton: true,
			noInputIcon: true,
		});
		expect(search.tagName).toBe("FAKE-PLACE-AUTOCOMPLETE");

		address.querySelector("[data-apply-address-manual-trigger]").click();
		expect(fields.hidden).toBe(false);

		search.value = "10 Downing";
		search.dispatchEvent(new Event("input", { bubbles: true }));
		expect(fields.hidden).toBe(false);

		const place = {
			formattedAddress: "10 Downing Street, London SW1A 2AA, UK",
			addressComponents: [
				{ longText: "10", types: ["street_number"] },
				{ longText: "Downing Street", types: ["route"] },
				{ longText: "London", types: ["postal_town"] },
				{ longText: "Greater London", types: ["administrative_area_level_2"] },
				{ longText: "SW1A 2AA", types: ["postal_code"] },
				{ longText: "United Kingdom", types: ["country"] },
			],
			fetchFields: vi.fn().mockResolvedValue(undefined),
		};
		autocomplete.select(place);
		await Promise.resolve();

		expect(place.fetchFields).toHaveBeenCalledWith({
			fields: ["addressComponents", "formattedAddress"],
		});

		expect(address.querySelector('[data-apply-address-field="line1"]').value).toBe(
			"10 Downing Street",
		);
		expect(address.querySelector('[data-apply-address-field="town"]').value).toBe("London");
		expect(address.querySelector('[data-apply-address-field="county"]').value).toBe("Greater London");
		expect(address.querySelector('[data-apply-address-field="postcode"]').value).toBe("SW1A 2AA");
		expect(address.querySelector('[data-apply-address-field="country"]').value).toBe("United Kingdom");
		expect(search.value).toBe("10 Downing Street, London SW1A 2AA, UK");
		expect(fields.querySelector('[data-apply-address-field="line1"]').disabled).toBe(false);
	});

	it("keeps manual address fields hidden while the user is typing", async () => {
		const loadGoogleMaps = vi
			.fn()
			.mockResolvedValue({ places: { PlaceAutocompleteElement: FakePlaceAutocompleteElement } });
		initApplicationForms(document, { loadGoogleMaps });
		await Promise.resolve();

		const address = document.querySelector("[data-apply-address]");
		const search = address.querySelector("[data-apply-address-search]");
		const fields = address.querySelector("[data-apply-address-fields]");

		expect(fields.hidden).toBe(true);
		search.value = "10 Downing";
		search.dispatchEvent(new Event("input", { bubbles: true }));

		expect(fields.hidden).toBe(true);
		expect(fields.querySelector('[data-apply-address-field="line1"]').disabled).toBe(true);
	});

	it("reveals manual entry and reports a New Places request error", async () => {
		const loadGoogleMaps = vi
			.fn()
			.mockResolvedValue({ places: { PlaceAutocompleteElement: FakePlaceAutocompleteElement } });
		initApplicationForms(document, { loadGoogleMaps });
		await Promise.resolve();

		const address = document.querySelector("[data-apply-address]");
		const fields = address.querySelector("[data-apply-address-fields]");
		const status = address.querySelector("[data-apply-address-status]");
		FakePlaceAutocompleteElement.instances[0].fail();

		expect(fields.hidden).toBe(false);
		expect(status.textContent).toBe(
			"Address lookup is unavailable. Enter your address manually.",
		);
	});

	it("is safe to initialize twice and keeps manual entry available without Google Maps", async () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const loadGoogleMaps = vi.fn().mockRejectedValue(new Error("blocked"));
		const root = document.querySelector("[data-apply-form]");
		const firstCleanup = initApplicationForms(document, { loadGoogleMaps });
		const secondCleanup = initApplicationForms(document, { loadGoogleMaps });
		const search = root.querySelector("[data-apply-address-search]");
		const fields = root.querySelector("[data-apply-address-fields]");
		root.querySelector("[data-apply-address-manual-trigger]").click();

		expect(firstCleanup).toBeTypeOf("function");
		expect(secondCleanup).toBe(firstCleanup);
		expect(fields.hidden).toBe(false);
		search.value = "";
		search.dispatchEvent(new Event("input", { bubbles: true }));
		expect(fields.hidden).toBe(false);
		await Promise.resolve();
		await Promise.resolve();
		expect(warn).toHaveBeenCalledWith("[application-form] Google Maps address lookup is unavailable.");
	});

	it("loads the Places library through the New API import contract", async () => {
		const importLibrary = vi.fn().mockResolvedValue({
			PlaceAutocompleteElement: FakePlaceAutocompleteElement,
		});
		globalThis.google = { maps: { importLibrary } };

		const maps = await loadGoogleMaps("demo-key", document);

		expect(importLibrary).toHaveBeenCalledWith("places");
		expect(maps.places.PlaceAutocompleteElement).toBe(FakePlaceAutocompleteElement);
	});
});
