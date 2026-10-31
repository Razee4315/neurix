/**
 * Cut a reply into pieces that won't change as more of it arrives, so only
 * the last piece is parsed again on each frame. A long reply would otherwise
 * cost more and more to draw as it streams.
 *
 * A blank line ends a piece, unless it sits inside a code block, where the
 * text after it still belongs to the block.
 */
export function splitStableBlocks(text: string): string[] {
	const blocks: string[] = [];
	let current: string[] = [];
	let inFence = false;

	for (const line of text.split("\n")) {
		if (line.trimStart().startsWith("```")) inFence = !inFence;
		if (!inFence && line.trim() === "") {
			if (current.length > 0) blocks.push(current.join("\n"));
			current = [];
			continue;
		}
		current.push(line);
	}
	if (current.length > 0) blocks.push(current.join("\n"));
	return blocks;
}
