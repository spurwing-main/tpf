const SELECTOR = {
	form: "[data-apply-form]",
	select: "[data-apply-select]",
	optionSource: "[data-apply-option-source]",
	option: "[data-apply-option]",
	address: "[data-apply-address]",
	addressSearch: "[data-apply-address-search]",
	addressManualTrigger: "[data-apply-address-manual-trigger]",
	addressFields: "[data-apply-address-fields]",
	addressField: "[data-apply-address-field]",
	addressStatus: "[data-apply-address-status]",
	campaignGroup: "[data-apply-campaign-group]",
	campaignSource: "[data-apply-campaign-source]",
	campaignOption: "[data-apply-campaign-option]",
	campaignOutput: "[data-apply-campaign-output]",
	campaignMessage: "[data-apply-campaign-message]",
	campaignList: "[data-apply-campaign-list]",
	coverNote: "[data-apply-cover-note]",
	role: "[data-apply-role]",
	pageUrl: "[data-apply-page-url]",
};

const ADDRESS_NAMES = {
	line1: "Address Line 1",
	line2: "Address Line 2",
	line3: "Address Line 3",
	town: "Town or City",
	county: "County",
	postcode: "Postcode",
	country: "Country",
};

const REQUIRED_ADDRESS_FIELDS = new Set(["line1", "town", "postcode"]);
const MAX_CAMPAIGNS = 10;
const initializedForms = new WeakMap();
const mapsPromises = new WeakMap();
let generatedId = 0;

function hydrateCampaigns(root) {
	const source = root.querySelector(SELECTOR.campaignSource);
	if (!source) return;

	root.querySelectorAll(SELECTOR.campaignGroup).forEach((group) => {
		const list = group.querySelector(SELECTOR.campaignList);
		console.log("Hydrating campaign group:", list);
		if (!list) return;

		list.replaceChildren();

		source.querySelectorAll(SELECTOR.campaignOption).forEach((sourceItem) => {
			list.append(sourceItem);
		});
	});
}

function getMatchingElements(root, selector) {
	const matches = [];
	if (root.nodeType === 1 && root.matches(selector)) matches.push(root);
	if (typeof root.querySelectorAll === "function") matches.push(...root.querySelectorAll(selector));
	return matches;
}

function setDefaultName(element, name) {
	if (element && !element.getAttribute("name")) element.setAttribute("name", name);
}

function hydrateSelect(root) {
	const source = root.querySelector(SELECTOR.optionSource);
	if (!source) return;

	root.querySelectorAll(SELECTOR.select).forEach((select) => {
		const placeholder = [...select.options].find((option) => option.value === "");
		select.replaceChildren(placeholder || select.ownerDocument.createElement("option"));

		if (!placeholder) {
			select.options[0].textContent = "Select an option";
			select.options[0].value = "";
		}

		for (const sourceOption of source.querySelectorAll(SELECTOR.option)) {
			const option = select.ownerDocument.createElement("option");
			const label = sourceOption.dataset.label || sourceOption.textContent.trim();
			option.value = sourceOption.dataset.value || label;
			option.textContent = label;
			select.append(option);
		}
	});
}

function resizeCoverNote(textarea) {
	textarea.style.height = "auto";
	textarea.style.height = `${textarea.scrollHeight}px`;
}

function setupCoverNotes(root) {
	const cleanups = [];
	root.querySelectorAll(SELECTOR.coverNote).forEach((textarea) => {
		const resize = () => resizeCoverNote(textarea);
		resize();
		textarea.addEventListener("input", resize);
		cleanups.push(() => textarea.removeEventListener("input", resize));
	});
	return () => cleanups.forEach((cleanup) => cleanup());
}

function setupMetadata(root) {
	const ownerDocument = root.ownerDocument || document;
	const view = ownerDocument.defaultView || globalThis;
	const roleValue =
		root.getAttribute("data-apply-role-value") ||
		root.querySelector("[data-apply-role-value]")?.value ||
		root.querySelector("[data-apply-role-value]")?.textContent.trim() ||
		"";

	root.querySelectorAll(SELECTOR.role).forEach((field) => {
		setDefaultName(field, "Role");
		if (!field.value && roleValue) field.value = roleValue;
	});

	root.querySelectorAll(SELECTOR.pageUrl).forEach((field) => {
		setDefaultName(field, "Page URL");
		if (!field.value && view.location?.href) field.value = view.location.href;
	});
}

function ensureMessageId(message) {
	if (message.id) return message.id;
	let id;
	do {
		generatedId += 1;
		id = `apply-campaign-message-${generatedId}`;
	} while (message.ownerDocument.getElementById(id));
	message.id = id;
	return id;
}

function getCampaignLabel(item, checkbox) {
	return (
		item.dataset.label ||
		item.dataset.value ||
		item.querySelector("[data-apply-campaign-label]")?.textContent.trim() ||
		checkbox.value ||
		item.textContent.trim()
	);
}

function setupCampaignGroup(group) {
	const source = group.querySelector(SELECTOR.campaignSource) || group;
	const records = [...source.querySelectorAll(SELECTOR.campaignOption)]
		.map((item) => {
			const checkbox = item.querySelector('input[type="checkbox"]');
			checkbox?.removeAttribute("name");
			return { item, checkbox };
		})
		.filter(({ checkbox }) => checkbox);
	const output = group.querySelector(SELECTOR.campaignOutput);
	if (!output || records.length === 0) return () => {};

	const checkboxes = records.map(({ checkbox }) => checkbox);
	const firstCheckbox = checkboxes[0];
	const message = group.querySelector(SELECTOR.campaignMessage);
	const describedBy = message ? ensureMessageId(message) : null;
	if (describedBy) firstCheckbox.setAttribute("aria-describedby", describedBy);

	setDefaultName(output, "Preferred Charity Campaigns");
	const sync = () => {
		const selected = records.filter(({ checkbox }) => checkbox.checked);
		if (selected.length > MAX_CAMPAIGNS) {
			selected.slice(MAX_CAMPAIGNS).forEach(({ checkbox }) => {
				checkbox.checked = false;
			});
		}
		const validSelected = records.filter(({ checkbox }) => checkbox.checked);
		output.value = validSelected
			.map(({ item, checkbox }) => getCampaignLabel(item, checkbox))
			.join(", ");
		const hasSelection = validSelected.length > 0;
		const atLimit = validSelected.length >= MAX_CAMPAIGNS;

		firstCheckbox.setCustomValidity(hasSelection ? "" : "Select at least one campaign.");
		checkboxes.forEach((checkbox) => {
			checkbox.disabled = atLimit && !checkbox.checked;
		});

		if (!message) return;
		if (!hasSelection) {
			message.textContent = "Select at least one campaign.";
		} else if (atLimit) {
			message.textContent = `You can select up to ${MAX_CAMPAIGNS} campaigns.`;
		} else {
			message.textContent = "";
		}
	};

	checkboxes.forEach((checkbox) => checkbox.addEventListener("change", sync));
	sync();

	return () => {
		checkboxes.forEach((checkbox) => {
			checkbox.removeEventListener("change", sync);
			checkbox.disabled = false;
			checkbox.setCustomValidity("");
		});
	};
}

function getAddressComponent(components, type) {
	const component = components.find((item) => item.types?.includes(type));
	return component?.longText || component?.shortText || "";
}

function mapPlaceToAddress(place) {
	const components = place?.addressComponents || [];
	const streetNumber = getAddressComponent(components, "street_number");
	const route = getAddressComponent(components, "route");

	return {
		line1: [streetNumber, route].filter(Boolean).join(" "),
		line2: getAddressComponent(components, "subpremise"),
		line3:
			getAddressComponent(components, "sublocality_level_1") ||
			getAddressComponent(components, "sublocality") ||
			getAddressComponent(components, "neighborhood"),
		town:
			getAddressComponent(components, "postal_town") ||
			getAddressComponent(components, "locality") ||
			getAddressComponent(components, "administrative_area_level_2"),
		county: getAddressComponent(components, "administrative_area_level_2"),
		postcode: getAddressComponent(components, "postal_code"),
		country: getAddressComponent(components, "country") || "United Kingdom",
	};
}

function applyAddressValues(fields, values) {
	for (const [key, value] of Object.entries(values)) {
		const field = fields.get(key);
		if (field) field.value = value;
	}
}

function showManualAddress(fields, wrapper, visible) {
	if (wrapper) wrapper.hidden = !visible;
	fields.forEach((field) => {
		field.disabled = !visible && field.dataset.applyAddressField !== "country";
	});
}

function getGoogleMaps() {
	return globalThis.google?.maps || null;
}

function hasPlaceAutocomplete(maps) {
	return typeof maps?.places?.PlaceAutocompleteElement === "function";
}

async function loadGoogleMaps(apiKey, ownerDocument = document) {
	const existingMaps = getGoogleMaps();
	if (hasPlaceAutocomplete(existingMaps)) return existingMaps;
	if (existingMaps?.importLibrary) {
		const places = await existingMaps.importLibrary("places");
		if (!hasPlaceAutocomplete(existingMaps)) {
			existingMaps.places = { ...existingMaps.places, ...places };
		}
		if (hasPlaceAutocomplete(existingMaps)) return existingMaps;
	}
	if (!apiKey) throw new Error("Google Maps API key is missing.");

	let documentPromises = mapsPromises.get(ownerDocument);
	if (!documentPromises) {
		documentPromises = new Map();
		mapsPromises.set(ownerDocument, documentPromises);
	}
	if (documentPromises.has(apiKey)) return documentPromises.get(apiKey);

	const promise = new Promise((resolve, reject) => {
		const script =
			ownerDocument.querySelector("script[data-apply-google-maps]") ||
			ownerDocument.createElement("script");
		if (!script.parentNode) {
			script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&v=weekly`;
			script.async = true;
			script.defer = true;
			script.setAttribute("data-apply-google-maps", "");
			ownerDocument.head.append(script);
		}

		const finish = async () => {
			try {
				const maps = getGoogleMaps();
				if (maps?.importLibrary && !hasPlaceAutocomplete(maps)) {
					const places = await maps.importLibrary("places");
					maps.places = { ...maps.places, ...places };
				}
				if (!hasPlaceAutocomplete(getGoogleMaps()))
					throw new Error("Places library is unavailable.");
				resolve(getGoogleMaps());
			} catch (error) {
				reject(error);
			}
		};

		script.addEventListener("load", finish, { once: true });
		script.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), {
			once: true,
		});
		if (hasPlaceAutocomplete(getGoogleMaps())) finish();
	});

	documentPromises.set(apiKey, promise);
	return promise;
}

function setupAddress(root, options) {
	const address = root.querySelector(SELECTOR.address);
	if (!address) return () => {};

	let search = address.querySelector(SELECTOR.addressSearch);
	if (!search) return () => {};
	const wrapper = address.querySelector(SELECTOR.addressFields);
	const fields = new Map();
	address.querySelectorAll(SELECTOR.addressField).forEach((field) => {
		const key = field.dataset.applyAddressField;
		if (!key) return;
		fields.set(key, field);
		setDefaultName(field, ADDRESS_NAMES[key] || key);
		if (REQUIRED_ADDRESS_FIELDS.has(key)) field.required = true;
	});
	let country = fields.get("country");
	if (!country) {
		country = address.ownerDocument.createElement("input");
		country.type = "hidden";
		country.dataset.applyAddressField = "country";
		address.append(country);
		fields.set("country", country);
	}
	setDefaultName(country, ADDRESS_NAMES.country);
	if (country) country.value = country.value || "United Kingdom";
	search.required = true;
	search.removeAttribute("name");
	let manualRevealed = [...fields.entries()].some(
		([key, field]) => key !== "country" && field.value,
	);
	showManualAddress(fields, wrapper, manualRevealed);

	const cleanups = [];
	const revealManualAddress = () => {
		manualRevealed = true;
		showManualAddress(fields, wrapper, true);
	};
	address.querySelectorAll(SELECTOR.addressManualTrigger).forEach((trigger) => {
		const onClick = (event) => {
			event.preventDefault();
			revealManualAddress();
			fields.get("line1")?.focus();
		};
		trigger.addEventListener("click", onClick);
		cleanups.push(() => trigger.removeEventListener("click", onClick));
	});

	const apiKeyElement = root.querySelector("[data-google-maps-api-key]");
	const apiKey =
		root.dataset.googleMapsApiKey ||
		address.dataset.googleMapsApiKey ||
		apiKeyElement?.dataset.googleMapsApiKey;
	const maps = getGoogleMaps();
	if (!apiKey && !hasPlaceAutocomplete(maps) && !maps?.importLibrary)
		return () => cleanups.forEach((cleanup) => cleanup());

	const loader = options.loadGoogleMaps || loadGoogleMaps;
	let disposed = false;
	const status = address.querySelector(SELECTOR.addressStatus);
	const showLookupError = () => {
		revealManualAddress();
		if (status) status.textContent = "Address lookup is unavailable. Enter your address manually.";
	};
	Promise.resolve(loader(apiKey, root.ownerDocument || document))
		.then((loadedMaps) => {
			if (disposed) return;
			const PlaceAutocompleteElement =
				loadedMaps?.places?.PlaceAutocompleteElement ||
				getGoogleMaps()?.places?.PlaceAutocompleteElement;
			if (!PlaceAutocompleteElement)
				throw new Error("Google Places PlaceAutocompleteElement is unavailable.");
			const autocomplete = new PlaceAutocompleteElement({
				includedRegionCodes: ["gb"],
				includedPrimaryTypes: ["street_address"],
				noClearButton: true,
				noInputIcon: true,
			});
			for (const attribute of [...search.attributes]) {
				if (attribute.name !== "name" && attribute.name !== "type") {
					autocomplete.setAttribute(attribute.name, attribute.value);
				}
			}
			autocomplete.removeAttribute("name");
			if (search.getAttribute("placeholder"))
				autocomplete.placeholder = search.getAttribute("placeholder");
		search.replaceWith(autocomplete);
		search = autocomplete;

		const onSelect = async ({ placePrediction }) => {
				try {
					const place = placePrediction?.toPlace?.();
					if (!place?.fetchFields) throw new Error("Selected place is unavailable.");
					await place.fetchFields({ fields: ["addressComponents", "formattedAddress"] });
					if (!place.addressComponents?.length) {
						showLookupError();
						return;
					}
					const values = mapPlaceToAddress(place);
					applyAddressValues(fields, values);
					revealManualAddress();
					if (place.formattedAddress) search.value = place.formattedAddress;
					if (status) status.textContent = "Address selected. You can edit the fields below.";
				} catch {
					if (!disposed) showLookupError();
				}
			};
			const onError = () => {
				if (!disposed) showLookupError();
			};
			autocomplete.addEventListener("gmp-select", onSelect);
			autocomplete.addEventListener("gmp-error", onError);
			cleanups.push(() => {
				autocomplete.removeEventListener("gmp-select", onSelect);
				autocomplete.removeEventListener("gmp-error", onError);
			});
		})
		.catch(() => {
			if (!disposed) {
				console.warn("[application-form] Google Maps address lookup is unavailable.");
				showLookupError();
			}
		});

	cleanups.push(() => {
		disposed = true;
	});
	return () => cleanups.forEach((cleanup) => cleanup());
}

function setupForm(root, options) {
	hydrateSelect(root);
	hydrateCampaigns(root);

	setupMetadata(root);
	const cleanups = [setupCoverNotes(root), setupAddress(root, options)];
	root
		.querySelectorAll(SELECTOR.campaignGroup)
		.forEach((group) => cleanups.push(setupCampaignGroup(group)));
	return () => cleanups.forEach((cleanup) => cleanup());
}

export function initApplicationForms(root = document, options = {}) {
	const forms = getMatchingElements(root, SELECTOR.form);
	if (forms.length === 1) {
		const existing = initializedForms.get(forms[0]);
		if (existing) return existing;
		const formCleanup = setupForm(forms[0], options);
		const cleanup = () => formCleanup();
		initializedForms.set(forms[0], cleanup);
		return cleanup;
	}

	const records = forms.map((form) => {
		const existing = initializedForms.get(form);
		if (existing) return existing;
		const cleanup = setupForm(form, options);
		initializedForms.set(form, cleanup);
		return cleanup;
	});

	return () => records.forEach((cleanup) => cleanup());
}

export { loadGoogleMaps, mapPlaceToAddress };
