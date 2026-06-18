import type { ParsedHunk, ParsedLine, SplitCell, SplitRow } from "./types.ts";

function toCell(line: ParsedLine): SplitCell {
	return {
		content: line.content,
		lineNum: line.type === "add" ? line.newLineNum : line.oldLineNum,
		type: line.type,
	};
}

function flushChanges(rows: SplitRow[], removed: ParsedLine[], added: ParsedLine[]) {
	const count = Math.max(removed.length, added.length);

	for (let i = 0; i < count; i++) {
		const left = removed[i] ? toCell(removed[i]) : null;
		const right = added[i] ? toCell(added[i]) : null;
		rows.push({ left, right, gutter: left && right ? "~" : "" });
	}

	removed.length = 0;
	added.length = 0;
}

export function pairLines(hunks: ParsedHunk[]): SplitRow[] {
	const rows: SplitRow[] = [];

	for (const hunk of hunks) {
		const removed: ParsedLine[] = [];
		const added: ParsedLine[] = [];

		for (const line of hunk.lines) {
			if (line.type === "remove") {
				removed.push(line);
				continue;
			}

			if (line.type === "add") {
				added.push(line);
				continue;
			}

			flushChanges(rows, removed, added);
			const cell = toCell(line);
			rows.push({ left: cell, right: cell, gutter: "" });
		}

		flushChanges(rows, removed, added);
	}

	return rows;
}
