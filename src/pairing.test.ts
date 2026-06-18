import { describe, expect, it } from "vitest";
import { pairLines } from "./pairing.js";
import { parseUnifiedPatch } from "./patch-parser.js";

describe("pairLines", () => {
	it("mirrors context lines on both sides", () => {
		const rows = pairLines(parseUnifiedPatch("@@ -2 +2 @@\n unchanged"));

		expect(rows).toEqual([
			{
				left: {
					content: "unchanged",
					lineNum: 2,
					type: "context",
				},
				right: {
					content: "unchanged",
					lineNum: 2,
					type: "context",
				},
				gutter: "",
			},
		]);
	});

	it("pairs replacements with a changed gutter", () => {
		const rows = pairLines(parseUnifiedPatch("@@ -4 +4 @@\n-before\n+after"));

		expect(rows).toEqual([
			{
				left: { content: "before", lineNum: 4, type: "remove" },
				right: { content: "after", lineNum: 4, type: "add" },
				gutter: "~",
			},
		]);
	});

	it("keeps unbalanced removals and additions in separate columns", () => {
		const rows = pairLines(
			parseUnifiedPatch("@@ -1,3 +1,2 @@\n-first\n-second\n+replacement"),
		);

		expect(rows).toEqual([
			{
				left: { content: "first", lineNum: 1, type: "remove" },
				right: { content: "replacement", lineNum: 1, type: "add" },
				gutter: "~",
			},
			{
				left: { content: "second", lineNum: 2, type: "remove" },
				right: null,
				gutter: "",
			},
		]);
	});

	it("flushes pending changes before context resumes", () => {
		const rows = pairLines(
			parseUnifiedPatch("@@ -1,2 +1,2 @@\n-old\n+new\n shared"),
		);

		expect(rows).toHaveLength(2);
		expect(rows[0].gutter).toBe("~");
		expect(rows[1]).toMatchObject({
			left: { content: "shared", type: "context" },
			right: { content: "shared", type: "context" },
			gutter: "",
		});
	});
});
