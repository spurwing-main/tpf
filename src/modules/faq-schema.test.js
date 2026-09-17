import { beforeEach, describe, expect, it, vi } from "vitest";
import { initFaqSchema } from "./faq-schema.js";

function getOutput(container) {
	return container.querySelector('script[type="application/ld+json"][data-faq-schema-output]');
}

describe("initFaqSchema", () => {
	beforeEach(() => {
		document.body.innerHTML = "";
		vi.restoreAllMocks();
	});

	it("writes FAQPage JSON-LD from the marked question and answer text", () => {
		document.body.innerHTML = `
			<section data-faq-schema>
				<article data-faq-item>
					<h2 data-faq-question>  Can I use &lt;strong&gt; markup?  </h2>
					<div data-faq-answer> Yes — visible text is safely encoded. </div>
				</article>
				<article data-faq-item>
					<h2 data-faq-question>What does it cost?</h2>
					<div data-faq-answer>It costs £10.</div>
				</article>
			</section>
		`;

		initFaqSchema();

		const output = getOutput(document.querySelector("[data-faq-schema]"));
		expect(JSON.parse(output.textContent)).toEqual({
			"@context": "https://schema.org",
			"@type": "FAQPage",
			mainEntity: [
				{
					"@type": "Question",
					name: "Can I use <strong> markup?",
					acceptedAnswer: {
						"@type": "Answer",
						text: "Yes — visible text is safely encoded.",
					},
				},
				{
					"@type": "Question",
					name: "What does it cost?",
					acceptedAnswer: { "@type": "Answer", text: "It costs £10." },
				},
			],
		});
	});

	it("creates an independent output for each marked container", () => {
		document.body.innerHTML = `
			<section data-faq-schema>
				<div data-faq-item><span data-faq-question>First?</span><span data-faq-answer>First.</span></div>
			</section>
			<section data-faq-schema>
				<div data-faq-item><span data-faq-question>Second?</span><span data-faq-answer>Second.</span></div>
			</section>
		`;

		initFaqSchema(document);

		const outputs = [...document.querySelectorAll("[data-faq-schema]")].map(getOutput);
		expect(outputs).toHaveLength(2);
		expect(outputs.map((output) => JSON.parse(output.textContent).mainEntity[0].name)).toEqual([
			"First?",
			"Second?",
		]);
	});

	it("skips incomplete items and warns once for each one", () => {
		document.body.innerHTML = `
			<section data-faq-schema>
				<div data-faq-item><span data-faq-question>Valid?</span><span data-faq-answer>Yes.</span></div>
				<div data-faq-item><span data-faq-question>Missing answer?</span></div>
				<div data-faq-item><span data-faq-question>   </span><span data-faq-answer>Blank question.</span></div>
			</section>
		`;
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		initFaqSchema(document);

		const schema = JSON.parse(getOutput(document.querySelector("[data-faq-schema]")).textContent);
		expect(schema.mainEntity).toHaveLength(1);
		expect(schema.mainEntity[0].name).toBe("Valid?");
		expect(warn).toHaveBeenCalledTimes(2);
	});

	it("does not add an output when a container has no complete FAQ items", () => {
		document.body.innerHTML = `
			<section data-faq-schema>
				<div data-faq-item><span data-faq-question>Question without an answer?</span></div>
			</section>
		`;
		vi.spyOn(console, "warn").mockImplementation(() => {});

		initFaqSchema(document);

		expect(getOutput(document.querySelector("[data-faq-schema]"))).toBeNull();
	});

	it("replaces its previous output when initialized again", () => {
		document.body.innerHTML = `
			<section data-faq-schema>
				<div data-faq-item><span data-faq-question>Original?</span><span data-faq-answer>Original.</span></div>
			</section>
		`;
		const container = document.querySelector("[data-faq-schema]");

		initFaqSchema(document);
		container.querySelector("[data-faq-question]").textContent = "Updated?";
		initFaqSchema(document);

		const outputs = container.querySelectorAll("[data-faq-schema-output]");
		expect(outputs).toHaveLength(1);
		expect(JSON.parse(outputs[0].textContent).mainEntity[0].name).toBe("Updated?");
	});
});
