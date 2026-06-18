import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import {
	applyEditsToNormalizedContent,
	computeOwnPreview,
	normalizeForFuzzyMatch,
	normalizeToLF,
	stripBom,
} from "./preview.js";

describe("normalizeToLF", () => {
	it("normalizes CRLF and CR newlines", () => {
		expect(normalizeToLF("a\r\nb\rc\n")).toBe("a\nb\nc\n");
	});
});

describe("stripBom", () => {
	it("separates a leading BOM from file text", () => {
		expect(stripBom("\uFEFFcontent")).toEqual({
			bom: "\uFEFF",
			text: "content",
		});
	});

	it("leaves text without a BOM unchanged", () => {
		expect(stripBom("content")).toEqual({ bom: "", text: "content" });
	});
});

describe("normalizeForFuzzyMatch", () => {
	it("normalizes quotes, dashes, no-break spaces, and trailing space", () => {
		expect(normalizeForFuzzyMatch("“hi” — there\u00A0 \nnext\t ")).toBe(
			'"hi" - there\nnext',
		);
	});
});

describe("applyEditsToNormalizedContent", () => {
	it("applies multiple non-overlapping edits without mutating order", () => {
		const result = applyEditsToNormalizedContent(
			"one\ntwo\nthree\n",
			[
				{ oldText: "three", newText: "THREE" },
				{ oldText: "one", newText: "ONE" },
			],
			"sample.txt",
		);

		expect(result).toEqual({
			baseContent: "one\ntwo\nthree\n",
			newContent: "ONE\ntwo\nTHREE\n",
		});
	});

	it("uses fuzzy matching for typographic characters", () => {
		const result = applyEditsToNormalizedContent(
			"const title = “Hello”—world;\n",
			[{ oldText: 'const title = "Hello"-world;', newText: "done();" }],
			"sample.ts",
		);

		expect(result).toEqual({
			baseContent: 'const title = "Hello"-world;\n',
			newContent: "done();\n",
		});
	});

	it("rejects empty oldText", () => {
		expect(() =>
			applyEditsToNormalizedContent(
				"content",
				[{ oldText: "", newText: "x" }],
				"sample.txt",
			),
		).toThrow("oldText must not be empty in sample.txt.");
	});

	it("rejects ambiguous matches", () => {
		expect(() =>
			applyEditsToNormalizedContent(
				"same\nsame\n",
				[{ oldText: "same", newText: "changed" }],
				"sample.txt",
			),
		).toThrow("Found 2 occurrences of the text in sample.txt.");
	});

	it("rejects overlapping edits", () => {
		expect(() =>
			applyEditsToNormalizedContent(
				"abcdef",
				[
					{ oldText: "abc", newText: "x" },
					{ oldText: "bcd", newText: "y" },
				],
				"sample.txt",
			),
		).toThrow("edits[0] and edits[1] overlap in sample.txt.");
	});

	it("rejects edits that make no change", () => {
		expect(() =>
			applyEditsToNormalizedContent(
				"content",
				[{ oldText: "content", newText: "content" }],
				"sample.txt",
			),
		).toThrow("No changes made to sample.txt.");
	});
});

describe("computeOwnPreview", () => {
	it("returns diff counts and does not modify the file", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pi-edit-split-"));
		const file = join(dir, "sample.txt");
		await writeFile(file, "alpha\nbeta\ngamma\n", "utf8");

		const preview = await computeOwnPreview(
			"sample.txt",
			[{ oldText: "beta", newText: "BETA\nextra" }],
			dir,
		);

		expect(preview.error).toBeUndefined();
		expect(preview.additions).toBe(2);
		expect(preview.deletions).toBe(1);
		expect(preview.patch).toContain("@@ -1,3 +1,4 @@");
		expect(preview.diff).toContain("-2 beta");
		expect(preview.diff).toContain("+2 BETA");
		expect(await readFile(file, "utf8")).toBe("alpha\nbeta\ngamma\n");
	});

	it("accepts paths with a leading at sign", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pi-edit-split-"));
		await writeFile(join(dir, "sample.txt"), "old\n", "utf8");

		const preview = await computeOwnPreview(
			"@sample.txt",
			[{ oldText: "old", newText: "new" }],
			dir,
		);

		expect(preview.error).toBeUndefined();
		expect(preview.additions).toBe(1);
		expect(preview.deletions).toBe(1);
	});

	it("returns an error preview when the file cannot be read", async () => {
		const dir = await mkdtemp(join(tmpdir(), "pi-edit-split-"));

		const preview = await computeOwnPreview(
			"missing.txt",
			[{ oldText: "old", newText: "new" }],
			dir,
		);

		expect(preview.hunks).toEqual([]);
		expect(preview.rows).toEqual([]);
		expect(preview.additions).toBe(0);
		expect(preview.deletions).toBe(0);
		expect(preview.error).toContain("missing.txt");
	});
});
