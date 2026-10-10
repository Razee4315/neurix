// The engine ends a reply at the model's end-of-turn token and never emits
// template tokens as text. These patterns are a last line of defence for a
// model file whose vocabulary does not mark its template tokens as control
// tokens; anything from such a token onward is not part of the answer.
//
// Role labels ("User:", "Human:") are deliberately not treated as a stop:
// a script, an interview or a chat log legitimately contains those lines.
const TEMPLATE_TOKENS: RegExp[] = [
	/<\|im_start\|>[\s\S]*$/,
	/<\|im_end\|>[\s\S]*$/,
	/<start_of_turn>[\s\S]*$/,
	/<end_of_turn>[\s\S]*$/,
	/<\|eot_id\|>[\s\S]*$/,
	/<\|start_header_id\|>[\s\S]*$/,
	/<\|endoftext\|>[\s\S]*$/,
];

export function cleanResponse(text: string): string {
	let cleaned = text;
	for (const pattern of TEMPLATE_TOKENS) {
		cleaned = cleaned.replace(pattern, "");
	}
	return cleaned.trim();
}
