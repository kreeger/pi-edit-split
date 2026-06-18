import { describe, expect, it } from "vitest";
import { countPatchLines, lineMarker, parseUnifiedPatch } from "./patch-parser.js";

describe("parseUnifiedPatch", () => {
	it("parses hunk metadata and line numbers", () => {
		const hunks = parseUnifiedPatch([
			"--- file.ts",
			"+++ file.ts",
			"@@ -10,3 +10,4 @@",
			" context",
			"-old",
			"+new",
			"+extra",
		].join("\n"));

		expect(hunks).toHaveLength(1);
		expect(hunks[0]).toMatchObject({
			header: "@@ -10,3 +10,4 @@",
			oldStart: 10,
			oldCount: 3,
			newStart: 10,
			newCount: 4,
		});
		expect(hunks[0].lines).toEqual([
			{
				type: "context",
				content: "context",
				oldLineNum: 10,
				newLineNum: 10,
			},
			{ type: "remove", content: "old", oldLineNum: 11, newLineNum: null },
			{ type: "add", content: "new", oldLineNum: null, newLineNum: 11 },
			{ type: "add", content: "extra", oldLineNum: null, newLineNum: 12 },
		]);
	});

	it("defaults missing hunk counts to one", () => {
		const hunks = parseUnifiedPatch("@@ -4 +8 @@\n-old\n+new");

		expect(hunks[0]).toMatchObject({
			oldStart: 4,
			oldCount: 1,
			newStart: 8,
			newCount: 1,
		});
	});

	it("ignores file headers and no-newline markers", () => {
		const hunks = parseUnifiedPatch([
			"diff --git a/file b/file",
			"--- a/file",
			"+++ b/file",
			"@@ -1 +1 @@",
			"-old",
			"\\ No newline at end of file",
			"+new",
		].join("\n"));

		expect(hunks[0].lines).toEqual([
			{ type: "remove", content: "old", oldLineNum: 1, newLineNum: null },
			{ type: "add", content: "new", oldLineNum: null, newLineNum: 1 },
		]);
	});

	it("throws when patch contains no hunks", () => {
		expect(() => parseUnifiedPatch("--- a\n+++ b\n-old\n+new")).toThrow(
			"No hunks found in patch",
		);
	});
});

describe("countPatchLines", () => {
	it("counts added and removed lines across hunks", () => {
		const hunks = parseUnifiedPatch([
			"@@ -1,2 +1,2 @@",
			" context",
			"-old",
			"+new",
			"@@ -8,1 +8,2 @@",
			"+extra",
		].join("\n"));

		expect(countPatchLines(hunks)).toEqual({ additions: 2, deletions: 1 });
	});
});

describe("lineMarker", () => {
	it("returns unified diff markers", () => {
		expect(lineMarker("add")).toBe("+");
		expect(lineMarker("remove")).toBe("-");
		expect(lineMarker("context")).toBe(" ");
	});
});
