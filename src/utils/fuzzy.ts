/**
 * How well `query` matches `text`, or null when it doesn't. Higher is better:
 * the whole text, then its start, then the start of a word, then anywhere,
 * then the letters in order with gaps ("mdl" finds "Models").
 */
export function matchScore(query: string, text: string): number | null {
	const q = query.trim().toLowerCase();
	const t = text.toLowerCase();
	if (!q) return 0;
	if (t === q) return 1000;
	if (t.startsWith(q)) return 800 - t.length;
	const at = t.indexOf(q);
	if (at > 0) {
		const wordStart = !/[\p{L}\p{N}]/u.test(t[at - 1]);
		return (wordStart ? 600 : 400) - at;
	}
	let from = 0;
	let gaps = 0;
	for (const letter of q) {
		const found = t.indexOf(letter, from);
		if (found < 0) return null;
		if (found > from) gaps += 1;
		from = found + 1;
	}
	return 200 - gaps * 10 - t.length / 10;
}

/** Keep what matches, best first, in the given order when equally good. */
export function rankMatches<T>(query: string, items: T[], label: (item: T) => string): T[] {
	return items
		.map((item, index) => ({ item, index, score: matchScore(query, label(item)) }))
		.filter((entry): entry is typeof entry & { score: number } => entry.score !== null)
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map((entry) => entry.item);
}
