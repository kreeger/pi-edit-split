import { describe, expect, it } from "vitest";
import { DiffRenderer } from "./diff-component.js";
import extension, { alwaysShowFullDiff } from "./index.js";
import { pairLines } from "./pairing.js";
import { countPatchLines, parseUnifiedPatch } from "./patch-parser.js";
import type { PreviewResult } from "./types.js";

function theme() {
	return {
		fg: (_name: string, text: string) => text,
		bg: (_name: string, text: string) => text,
		bold: (text: string) => text,
	};
}

function registeredEditTool() {
	let tool: any;
	extension({ registerTool: (definition: any) => { tool = definition; } } as any);
	return tool;
}

function previewFromPatch(patch: string): PreviewResult {
	const hunks = parseUnifiedPatch(patch);
	return {
		hunks,
		rows: pairLines(hunks),
		...countPatchLines(hunks),
		patch,
	};
}

const patch = [
	"--- a/file.ts",
	"+++ b/file.ts",
	"@@ -1 +1 @@",
	"-old",
	"+new",
].join("\n");

const longPatch = [
	"--- a/file.ts",
	"+++ b/file.ts",
	"@@ -1,55 +1,55 @@",
	...Array.from({ length: 55 }, (_, index) => ` context ${index + 1}`),
].join("\n");

describe("pi-edit-split settings", () => {
	it("reads the global alwaysShowFullDiff setting", () => {
		const settings = {
			getGlobalSettings: () => ({ piEditSplit: { alwaysShowFullDiff: true } }),
			getProjectSettings: () => ({}),
		};

		expect(alwaysShowFullDiff(settings)).toBe(true);
	});

	it("defaults alwaysShowFullDiff to false", () => {
		expect(
			alwaysShowFullDiff({
				getGlobalSettings: () => ({}),
				getProjectSettings: () => ({}),
			}),
		).toBe(false);
	});

	it("allows project settings to override the global setting", () => {
		const settings = {
			getGlobalSettings: () => ({ piEditSplit: { alwaysShowFullDiff: true } }),
			getProjectSettings: () => ({ piEditSplit: { alwaysShowFullDiff: false } }),
		};

		expect(alwaysShowFullDiff(settings)).toBe(false);
	});
});

describe("pi-edit-split rendering", () => {
	it("adds top and bottom padding around completed output", () => {
		const tool = registeredEditTool();
		const component = tool.renderResult(
			{ content: [], details: { patch } },
			{ expanded: true },
			theme(),
			{ args: { path: "file.ts" }, isError: false },
		);

		const lines = component.render(120);

		expect(lines[0].trim()).toBe("");
		expect(lines.at(-1)?.trim()).toBe("");
	});

	it("shows one more line around edits in collapsed split view", () => {
		const preview = previewFromPatch([
			"--- a/file.ts",
			"+++ b/file.ts",
			"@@ -1,9 +1,9 @@",
			" line one",
			" line two",
			" line three",
			" line four",
			"-old value",
			"+new value",
			" line six",
			" line seven",
			" line eight",
		].join("\n"));
		const component = new DiffRenderer(preview, theme(), { expanded: false });

		const lines = component.render(120).join("\n");

		expect(lines).toContain("line two");
		expect(lines).toContain("old value");
		expect(lines).toContain("new value");
		expect(lines).toContain("line six");
		expect(lines).toContain("line seven");
	});

	it("renders every diff row in expanded split view", () => {
		const preview = previewFromPatch(longPatch);
		const component = new DiffRenderer(preview, theme(), { expanded: true });

		const output = component.render(120).join("\n");

		expect(output).toContain("context 55");
		expect(output).not.toContain("lines hidden");
	});

	it("keeps compact split view truncated", () => {
		const preview = previewFromPatch(longPatch);
		const component = new DiffRenderer(preview, theme(), { expanded: false });

		const output = component.render(120).join("\n");

		expect(output).not.toContain("context 55");
		expect(output).toContain("lines hidden");
	});

	it("renders every diff row when full output is configured", () => {
		const preview = previewFromPatch(longPatch);
		const component = new DiffRenderer(preview, theme(), {
			alwaysShowFullDiff: true,
		});

		const output = component.render(120).join("\n");

		expect(output).toContain("context 55");
		expect(output).not.toContain("lines hidden");
	});

	it("renders every unified diff line in expanded view", () => {
		const preview = previewFromPatch(longPatch);
		const component = new DiffRenderer(preview, theme(), {
			expanded: true,
			diffText: longPatch,
		});

		const output = component.render(80).join("\n");

		expect(output).toContain("context 55");
		expect(output).not.toContain("lines hidden");
	});

	it("normalizes tabs in split output", () => {
		const preview = previewFromPatch([
			"--- a/file.ts",
			"+++ b/file.ts",
			"@@ -1 +1 @@",
			"-\tconst oldValue = 1;",
			"+\tconst newValue = 1;",
		].join("\n"));
		const component = new DiffRenderer(preview, theme(), { expanded: true });

		const lines = component.render(120);

		expect(lines.join("\n")).not.toContain("\t");
	});

	it("shows the completed edit header only once", () => {
		const tool = registeredEditTool();
		const preview = previewFromPatch(patch);
		const state = { preview };

		const call = tool.renderCall({ path: "file.ts", edits: [] }, theme(), {
			state,
			argsComplete: true,
			executionStarted: true,
		});
		const result = tool.renderResult(
			{ content: [], details: { patch } },
			{ expanded: true },
			theme(),
			{ args: { path: "file.ts" }, isError: false, state },
		);

		const lines = [...call.render(120), ...result.render(120)];
		const headerLines = lines.filter((line) => line.includes("edit file.ts +1/-1"));

		expect(headerLines).toHaveLength(1);
	});
});
