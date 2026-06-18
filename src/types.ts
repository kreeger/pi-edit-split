export type LineType = "add" | "remove" | "context";

export interface ParsedHunk {
	header: string;
	oldStart: number;
	oldCount: number;
	newStart: number;
	newCount: number;
	lines: ParsedLine[];
}

export interface ParsedLine {
	type: LineType;
	content: string;
	oldLineNum: number | null;
	newLineNum: number | null;
}

export interface SplitCell {
	content: string;
	lineNum: number | null;
	type: LineType | "empty";
}

export interface SplitRow {
	left: SplitCell | null;
	right: SplitCell | null;
	gutter: string;
}

export interface PreviewResult {
	hunks: ParsedHunk[];
	rows: SplitRow[];
	additions: number;
	deletions: number;
	diff?: string;
	patch?: string;
	error?: string;
}

export interface EditDiffState {
	preview?: PreviewResult;
	previewError?: string;
	previewKey?: string;
	pending?: boolean;
}
