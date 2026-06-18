import { renderDiff, type Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth, type Component } from "@earendil-works/pi-tui";
import { pairLines } from "./pairing.ts";
import { lineMarker } from "./patch-parser.ts";
import type { ParsedHunk, PreviewResult, SplitCell, SplitRow } from "./types.ts";

export interface DiffRendererOptions {
	expanded?: boolean;
	diffText?: string;
}

interface HeaderEntry {
	kind: "header";
	header: string;
}

interface RowEntry {
	kind: "row";
	row: SplitRow;
}

type DiffEntry = HeaderEntry | RowEntry;

const MAX_EXPANDED_LINES = 50;
const MAX_COLLAPSED_LINES = 7;
const TAB_WIDTH = 4;

function expandTabs(text: string): string {
	let column = 0;
	let expanded = "";

	for (const char of text) {
		if (char === "\t") {
			const spaces = TAB_WIDTH - (column % TAB_WIDTH);
			expanded += " ".repeat(spaces);
			column += spaces;
		} else {
			expanded += char;
			column += visibleWidth(char);
		}
	}

	return expanded;
}

function padVisible(text: string, width: number): string {
	const delta = width - visibleWidth(text);
	return delta > 0 ? text + " ".repeat(delta) : truncateToWidth(text, width, "…");
}

function cellLine(cell: SplitCell | null, width: number, theme: Theme): string {
	if (!cell) return " ".repeat(width);

	const rawLineNum = cell.lineNum == null ? "" : String(cell.lineNum);
	const lineNum = theme.fg("dim", rawLineNum.padStart(4, " "));
	const contentWidth = Math.max(1, width - 7);
	let content = truncateToWidth(expandTabs(cell.content), contentWidth, "…");

	if (cell.type === "add") content = theme.fg("toolDiffAdded", content);
	else if (cell.type === "remove") content = theme.fg("toolDiffRemoved", content);
	else content = theme.fg("toolDiffContext", content);

	return padVisible(`${lineNum} │ ${content}`, width);
}

function compactLine(cell: SplitCell, width: number, theme: Theme): string {
	const prefix = cell.type === "add" ? "+" : cell.type === "remove" ? "-" : " ";
	let text = `${prefix} ${expandTabs(cell.content)}`;

	if (cell.type === "add") text = theme.fg("toolDiffAdded", text);
	else if (cell.type === "remove") text = theme.fg("toolDiffRemoved", text);
	else text = theme.fg("toolDiffContext", text);

	return truncateToWidth(text, width, "…");
}

function patchFromHunks(hunks: ParsedHunk[]): string {
	const lines: string[] = [];
	for (const hunk of hunks) {
		lines.push(hunk.header);
		for (const line of hunk.lines) lines.push(lineMarker(line.type) + line.content);
	}
	return lines.join("\n");
}

export class DiffRenderer implements Component {
	private result: PreviewResult;
	private theme: Theme;
	private options: DiffRendererOptions;

	constructor(result: PreviewResult, theme: Theme, options: DiffRendererOptions = {}) {
		this.result = result;
		this.theme = theme;
		this.options = options;
	}

	setResult(result: PreviewResult, options: DiffRendererOptions = {}) {
		this.result = result;
		this.options = options;
	}

	invalidate(): void {}

	render(width: number): string[] {
		if (width >= 120) return this.renderSplit(width);
		if (width >= 80) return this.renderUnified(width);
		return this.renderCompact(width);
	}

	private maxLines(): number {
		return this.options.expanded ? MAX_EXPANDED_LINES : MAX_COLLAPSED_LINES;
	}

	private entriesForHunks(): DiffEntry[] {
		const entries: DiffEntry[] = [];
		for (const hunk of this.result.hunks) {
			entries.push({ kind: "header", header: hunk.header });
			for (const row of pairLines([hunk])) entries.push({ kind: "row", row });
		}
		return entries;
	}

	private truncateEntries(entries: DiffEntry[]): { shown: DiffEntry[]; hidden: number } {
		const maxLines = this.maxLines();
		if (entries.length <= maxLines) return { shown: entries, hidden: 0 };

		const firstChange = entries.findIndex((entry) =>
			entry.kind === "row" &&
			(entry.row.left?.type !== "context" || entry.row.right?.type !== "context")
		);
		const focus = firstChange === -1 ? 0 : firstChange;
		const start = Math.min(
			Math.max(0, focus - Math.floor(maxLines / 2)),
			entries.length - maxLines,
		);

		return {
			shown: entries.slice(start, start + maxLines),
			hidden: entries.length - maxLines,
		};
	}

	private hiddenNotice(hidden: number, width: number): string {
		return truncateToWidth(this.theme.fg("dim", `… ${hidden} lines hidden`), width, "…");
	}

	private renderSplit(width: number): string[] {
		const lines: string[] = [];
		const innerWidth = Math.max(1, width - 2);
		const halfWidth = Math.floor((innerWidth - 1) / 2);
		const rightWidth = innerWidth - halfWidth - 1;
		const { shown, hidden } = this.truncateEntries(this.entriesForHunks());

		lines.push(truncateToWidth(this.theme.fg("borderMuted", "─".repeat(width)), width, ""));

		for (const entry of shown) {
			if (entry.kind === "header") {
				lines.push(truncateToWidth(this.theme.fg("dim", entry.header), width, "…"));
				continue;
			}

			const left = cellLine(entry.row.left, halfWidth, this.theme);
			const right = cellLine(entry.row.right, rightWidth, this.theme);
			const divider = this.theme.fg("borderMuted", "│");
			lines.push(truncateToWidth(`${left}${divider}${right}`, width, ""));
		}

		if (hidden > 0) lines.push(this.hiddenNotice(hidden, width));
		lines.push(truncateToWidth(this.theme.fg("borderMuted", "─".repeat(width)), width, ""));
		return lines.map((line) => truncateToWidth(line, width, ""));
	}

	private renderUnified(width: number): string[] {
		const source = this.options.diffText ?? this.result.diff ?? patchFromHunks(this.result.hunks);
		let rendered: string[];

		try {
			rendered = renderDiff(source).split("\n");
		} catch {
			rendered = source.split("\n").map((line) => this.theme.fg("toolDiffContext", line));
		}

		const maxLines = this.maxLines();
		const shown = rendered.slice(0, maxLines).map((line) => truncateToWidth(line, width, "…"));
		const hidden = Math.max(0, rendered.length - shown.length);
		if (hidden > 0) shown.push(this.hiddenNotice(hidden, width));
		return shown.map((line) => truncateToWidth(line, width, ""));
	}

	private renderCompact(width: number): string[] {
		const lines: string[] = [];
		const { shown, hidden } = this.truncateEntries(this.entriesForHunks());

		for (const entry of shown) {
			if (entry.kind === "header") {
				lines.push(truncateToWidth(this.theme.fg("dim", entry.header), width, "…"));
				continue;
			}

			if (entry.row.left) lines.push(compactLine(entry.row.left, width, this.theme));
			if (entry.row.right && entry.row.right !== entry.row.left) {
				lines.push(compactLine(entry.row.right, width, this.theme));
			}
		}

		if (hidden > 0) lines.push(this.hiddenNotice(hidden, width));
		return lines.map((line) => truncateToWidth(line, width, ""));
	}
}
