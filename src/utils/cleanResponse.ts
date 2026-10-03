// Trim stop-sequence artifacts and chat-template tokens that occasionally
// leak through when a model finishes a turn before its EOS token fires.
const STOP_PATTERNS: RegExp[] = [
	// Role labels count only at the start of a line. "user:" inside a
	// sentence, a YAML key, or a line of code is ordinary output.
	/(^|\n)(Human|User):[\s\S]*$/,
	/<\|im_start\|>[\s\S]*$/,
	/<\|im_end\|>[\s\S]*$/,
	/<start_of_turn>[\s\S]*$/,
	/<end_of_turn>[\s\S]*$/,
	/<\|eot_id\|>[\s\S]*$/,
	/<\|start_header_id\|>[\s\S]*$/,
	/<\|end\|>[\s\S]*$/,
	/<\|user\|>[\s\S]*$/,
	/<\|endoftext\|>[\s\S]*$/,
];

export function cleanResponse(text: string): string {
	let cleaned = text;
	for (const pattern of STOP_PATTERNS) {
		cleaned = cleaned.replace(pattern, "");
	}
	return cleaned.trim();
}
