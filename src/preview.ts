import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pairLines } from "./pairing.ts";
import { countPatchLines, parseUnifiedPatch } from "./patch-parser.ts";
import type { PreviewResult } from "./types.ts";

export interface EditInputBlock {
	oldText: string;
	newText: string;
}

interface MatchedEdit {
	editIndex: number;
	matchIndex: number;
	matchLength: number;
	newText: string;
}

interface LineOp {
	type: "context" | "remove" | "add";
	line: string;
}

function normalizePath(path: string, cwd: string): string {
	const cleanPath = path.startsWith("@") ? path.slice(1) : path;
	return resolve(cwd, cleanPath);
}

export function normalizeToLF(text: string): string {
	return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

export function stripBom(content: string): { bom: string; text: string } {
	return content.startsWith("\uFEFF")
		? { bom: "\uFEFF", text: content.slice(1) }
		: { bom: "", text: content };
}

export function normalizeForFuzzyMatch(text: string): string {
	return text
		.normalize("NFKC")
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n")
		.replace(/[\u2018\u2019\u201A\u201B]/g, "'")
		.replace(/[\u201C\u201D\u201E\u201F]/g, '"')
		.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, "-")
		.replace(/[\u00A0\u2002-\u200A\u202F\u205F\u3000]/g, " ");
}

function fuzzyFindText(content: string, oldText: string) {
	const exactIndex = content.indexOf(oldText);
	if (exactIndex !== -1) {
		return {
			found: true,
			index: exactIndex,
			matchLength: oldText.length,
			usedFuzzyMatch: false,
		};
	}

	const fuzzyContent = normalizeForFuzzyMatch(content);
	const fuzzyOldText = normalizeForFuzzyMatch(oldText);
	const fuzzyIndex = fuzzyContent.indexOf(fuzzyOldText);

	return {
		found: fuzzyIndex !== -1,
		index: fuzzyIndex,
		matchLength: fuzzyOldText.length,
		usedFuzzyMatch: fuzzyIndex !== -1,
	};
}

function countOccurrences(content: string, oldText: string): number {
	const fuzzyContent = normalizeForFuzzyMatch(content);
	const fuzzyOldText = normalizeForFuzzyMatch(oldText);
	return fuzzyContent.split(fuzzyOldText).length - 1;
}

function editError(path: string, editIndex: number, total: number, message: string): Error {
	if (total === 1) return new Error(`${message} in ${path}.`);
	return new Error(`${message} for edits[${editIndex}] in ${path}.`);
}

export function applyEditsToNormalizedContent(
	normalizedContent: string,
	edits: EditInputBlock[],
	path: string,
): { baseContent: string; newContent: string } {
	const normalizedEdits = edits.map((edit) => ({
		oldText: normalizeToLF(edit.oldText),
		newText: normalizeToLF(edit.newText),
	}));

	for (let i = 0; i < normalizedEdits.length; i++) {
		if (normalizedEdits[i].oldText.length === 0) {
			throw editError(path, i, normalizedEdits.length, "oldText must not be empty");
		}
	}

	const initialMatches = normalizedEdits.map((edit) =>
		fuzzyFindText(normalizedContent, edit.oldText),
	);
	const baseContent = initialMatches.some((match) => match.usedFuzzyMatch)
		? normalizeForFuzzyMatch(normalizedContent)
		: normalizedContent;
	const matchedEdits: MatchedEdit[] = [];

	for (let i = 0; i < normalizedEdits.length; i++) {
		const edit = normalizedEdits[i];
		const match = fuzzyFindText(baseContent, edit.oldText);
		if (!match.found) {
			throw editError(
				path,
				i,
				normalizedEdits.length,
				"Could not find the exact text",
			);
		}

		const occurrences = countOccurrences(baseContent, edit.oldText);
		if (occurrences > 1) {
			throw editError(
				path,
				i,
				normalizedEdits.length,
				`Found ${occurrences} occurrences of the text`,
			);
		}

		matchedEdits.push({
			editIndex: i,
			matchIndex: match.index,
			matchLength: match.matchLength,
			newText: edit.newText,
		});
	}

	matchedEdits.sort((a, b) => a.matchIndex - b.matchIndex);
	for (let i = 1; i < matchedEdits.length; i++) {
		const previous = matchedEdits[i - 1];
		const current = matchedEdits[i];
		if (previous.matchIndex + previous.matchLength > current.matchIndex) {
			throw new Error(
				`edits[${previous.editIndex}] and edits[${current.editIndex}] overlap in ${path}.`,
			);
		}
	}

	let newContent = baseContent;
	for (let i = matchedEdits.length - 1; i >= 0; i--) {
		const edit = matchedEdits[i];
		newContent =
			newContent.slice(0, edit.matchIndex) +
			edit.newText +
			newContent.slice(edit.matchIndex + edit.matchLength);
	}

	if (baseContent === newContent) {
		throw new Error(`No changes made to ${path}.`);
	}

	return { baseContent, newContent };
}

function splitLines(content: string): string[] {
	const lines = content.split("\n");
	if (lines.at(-1) === "") lines.pop();
	return lines;
}

function diffByPrefixSuffix(oldLines: string[], newLines: string[]): LineOp[] {
	let start = 0;
	while (start < oldLines.length && start < newLines.length && oldLines[start] === newLines[start]) {
		start++;
	}

	let oldEnd = oldLines.length - 1;
	let newEnd = newLines.length - 1;
	while (oldEnd >= start && newEnd >= start && oldLines[oldEnd] === newLines[newEnd]) {
		oldEnd--;
		newEnd--;
	}

	const ops: LineOp[] = [];
	for (let i = 0; i < start; i++) ops.push({ type: "context", line: oldLines[i] });
	for (let i = start; i <= oldEnd; i++) ops.push({ type: "remove", line: oldLines[i] });
	for (let i = start; i <= newEnd; i++) ops.push({ type: "add", line: newLines[i] });
	for (let i = oldEnd + 1; i < oldLines.length; i++) {
		ops.push({ type: "context", line: oldLines[i] });
	}
	return ops;
}

function diffLines(oldContent: string, newContent: string): LineOp[] {
	const oldLines = splitLines(oldContent);
	const newLines = splitLines(newContent);
	const cells = oldLines.length * newLines.length;

	if (cells > 1_000_000) return diffByPrefixSuffix(oldLines, newLines);

	const dp = Array.from({ length: oldLines.length + 1 }, () =>
		new Array<number>(newLines.length + 1).fill(0),
	);

	for (let i = oldLines.length - 1; i >= 0; i--) {
		for (let j = newLines.length - 1; j >= 0; j--) {
			dp[i][j] = oldLines[i] === newLines[j]
				? dp[i + 1][j + 1] + 1
				: Math.max(dp[i + 1][j], dp[i][j + 1]);
		}
	}

	const ops: LineOp[] = [];
	let i = 0;
	let j = 0;
	while (i < oldLines.length && j < newLines.length) {
		if (oldLines[i] === newLines[j]) {
			ops.push({ type: "context", line: oldLines[i] });
			i++;
			j++;
		} else if (dp[i + 1][j] >= dp[i][j + 1]) {
			ops.push({ type: "remove", line: oldLines[i++] });
		} else {
			ops.push({ type: "add", line: newLines[j++] });
		}
	}

	while (i < oldLines.length) ops.push({ type: "remove", line: oldLines[i++] });
	while (j < newLines.length) ops.push({ type: "add", line: newLines[j++] });
	return ops;
}

function generateUnifiedPatch(path: string, oldContent: string, newContent: string): string {
	const ops = diffLines(oldContent, newContent);
	if (ops.every((op) => op.type === "context")) return "";

	let oldLine = 1;
	let newLine = 1;
	let firstChange = -1;
	let lastChange = -1;
	const numbered = ops.map((op, index) => {
		const entry = { ...op, oldLine, newLine };
		if (op.type !== "add") oldLine++;
		if (op.type !== "remove") newLine++;
		if (op.type !== "context") {
			if (firstChange === -1) firstChange = index;
			lastChange = index;
		}
		return entry;
	});

	const start = Math.max(0, firstChange - 4);
	const end = Math.min(numbered.length - 1, lastChange + 4);
	const hunk = numbered.slice(start, end + 1);
	const oldStart = hunk.find((op) => op.type !== "add")?.oldLine ?? 0;
	const newStart = hunk.find((op) => op.type !== "remove")?.newLine ?? 0;
	const oldCount = hunk.filter((op) => op.type !== "add").length;
	const newCount = hunk.filter((op) => op.type !== "remove").length;
	const body = hunk.map((op) => {
		const marker = op.type === "add" ? "+" : op.type === "remove" ? "-" : " ";
		return marker + op.line;
	});

	return [`--- ${path}`, `+++ ${path}`, `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`, ...body].join("\n");
}

function generateDisplayDiff(oldContent: string, newContent: string): string {
	const ops = diffLines(oldContent, newContent);
	const maxLine = Math.max(splitLines(oldContent).length, splitLines(newContent).length);
	const width = String(maxLine).length;
	let oldLine = 1;
	let newLine = 1;
	const output: string[] = [];

	for (const op of ops) {
		if (op.type === "context") {
			output.push(` ${String(oldLine).padStart(width, " ")} ${op.line}`);
			oldLine++;
			newLine++;
		} else if (op.type === "remove") {
			output.push(`-${String(oldLine).padStart(width, " ")} ${op.line}`);
			oldLine++;
		} else {
			output.push(`+${String(newLine).padStart(width, " ")} ${op.line}`);
			newLine++;
		}
	}

	return output.join("\n");
}

export async function computeOwnPreview(
	path: string,
	edits: EditInputBlock[],
	cwd: string,
): Promise<PreviewResult> {
	try {
		const absolutePath = normalizePath(path, cwd);
		try {
			await access(absolutePath, constants.R_OK);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return { hunks: [], rows: [], additions: 0, deletions: 0, error: message };
		}

		const rawContent = await readFile(absolutePath, "utf8");
		const { text } = stripBom(rawContent);
		const normalizedContent = normalizeToLF(text);
		const { baseContent, newContent } = applyEditsToNormalizedContent(
			normalizedContent,
			edits,
			path,
		);
		const patch = generateUnifiedPatch(path, baseContent, newContent);
		if (!patch) return { hunks: [], rows: [], additions: 0, deletions: 0, patch };

		const hunks = parseUnifiedPatch(patch);
		const rows = pairLines(hunks);
		const counts = countPatchLines(hunks);

		return {
			hunks,
			rows,
			...counts,
			diff: generateDisplayDiff(baseContent, newContent),
			patch,
		};
	} catch (error) {
		return {
			hunks: [],
			rows: [],
			additions: 0,
			deletions: 0,
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
