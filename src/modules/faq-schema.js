const selectors = {
	container: "[data-faq-schema]",
	item: "[data-faq-item]",
	question: "[data-faq-question]",
	answer: "[data-faq-answer]",
	output: "script[data-faq-schema-output]",
};

function createQuestion(item) {
	const question = item.querySelector(selectors.question)?.textContent.trim();
	const answer = item.querySelector(selectors.answer)?.textContent.trim();

	if (!question || !answer) {
		console.warn(
			"[faq-schema] Skipped a data-faq-item because it needs non-empty question and answer elements.",
		);
		return null;
	}

	return {
		"@type": "Question",
		name: question,
		acceptedAnswer: {
			"@type": "Answer",
			text: answer,
		},
	};
}

function writeSchema(container) {
	container.querySelector(selectors.output)?.remove();

	const questions = [...container.querySelectorAll(selectors.item)]
		.map(createQuestion)
		.filter(Boolean);

	if (questions.length === 0) return;

	const output = container.ownerDocument.createElement("script");
	output.type = "application/ld+json";
	output.setAttribute("data-faq-schema-output", "");
	output.textContent = JSON.stringify({
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: questions,
	});
	container.append(output);
}

export function initFaqSchema(root = document) {
	root.querySelectorAll(selectors.container).forEach(writeSchema);
}
