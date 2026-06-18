import type { LineType, ParsedHunk, ParsedLine } from "./types.ts";

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/;

function parseCount(value: string | undefined): number {
	return value === undefined ? 1 : Number(value);
}

export function parseUnifiedPatch(patch: string): ParsedHunk[] {
	const hunks: ParsedHunk[] = [];
	let current: ParsedHunk | null = null;
	let oldLine = 0;
	let newLine = 0;

	for (const rawLine of patch.split("\n")) {
		const header = rawLine.match(HUNK_RE);
		if (header) {
			if (current) hunks.push(current);

			const oldStart = Number(header[1]);
			const oldCount = parseCount(header[2]);
			const newStart = Number(header[3]);
			const newCount = parseCount(header[4]);

			current = {
				header: rawLine,
				oldStart,
				oldCount,
				newStart,
				newCount,
				lines: [],
			};
			oldLine = oldStart;
			newLine = newStart;
			continue;
		}

		if (!current) continue;
		if (rawLine.startsWith("\\ No newline at end of file")) continue;
		if (rawLine.length === 0) continue;

		const marker = rawLine[0];
		if (marker !== " " && marker !== "+" && marker !== "-") continue;

		const content = rawLine.slice(1);
		let parsed: ParsedLine;

		if (marker === " ") {
			parsed = {
				type: "context",
				content,
				oldLineNum: oldLine++,
				newLineNum: newLine++,
			};
		} else if (marker === "-") {
			parsed = {
				type: "remove",
				content,
				oldLineNum: oldLine++,
				newLineNum: null,
			};
		} else {
			parsed = {
				type: "add",
				content,
				oldLineNum: null,
				newLineNum: newLine++,
			};
		}

		current.lines.push(parsed);
	}

	if (current) hunks.push(current);
	if (hunks.length === 0) throw new Error("No hunks found in patch");
	return hunks;
}

export function countPatchLines(hunks: ParsedHunk[]): {
	additions: number;
	deletions: number;
} {
	let additions = 0;
	let deletions = 0;

	for (const hunk of hunks) {
		for (const line of hunk.lines) {
			if (line.type === "add") additions++;
			if (line.type === "remove") deletions++;
		}
	}

	return { additions, deletions };
}

export function lineMarker(type: LineType): string {
	if (type === "add") return "+";
	if (type === "remove") return "-";
	return " ";
}
