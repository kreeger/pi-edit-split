import {
	createEditTool,
	createEditToolDefinition,
	renderDiff,
	type ExtensionAPI,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { Box, Container, Text, truncateToWidth, type Component } from "@earendil-works/pi-tui";
import { DiffRenderer } from "./diff-component.ts";
import { pairLines } from "./pairing.ts";
import { countPatchLines, parseUnifiedPatch } from "./patch-parser.ts";
import { computeOwnPreview, type EditInputBlock } from "./preview.ts";
import type { EditDiffState, PreviewResult } from "./types.ts";

interface EditArgs {
	path?: string;
	edits?: EditInputBlock[];
}

interface EditDetails {
	diff?: string;
	patch?: string;
	firstChangedLine?: number;
}

function isRenderableArgs(args: EditArgs): args is { path: string; edits: EditInputBlock[] } {
	return (
		typeof args?.path === "string" &&
		Array.isArray(args.edits) &&
		args.edits.every(
			(edit) => typeof edit?.oldText === "string" && typeof edit?.newText === "string",
		)
	);
}

function argsKey(args: { path: string; edits: EditInputBlock[] }): string {
	return JSON.stringify({ path: args.path, edits: args.edits });
}

function textFromResult(result: { content?: Array<{ type?: string; text?: string }> }): string {
	return result.content
		?.filter((part) => part.type === "text" && typeof part.text === "string")
		.map((part) => part.text)
		.join("\n") ?? "";
}

function box(theme: Theme, bg: "toolPendingBg" | "toolSuccessBg" | "toolErrorBg"): Box {
	return new Box(1, 1, (text) => theme.bg(bg, text));
}

function header(path: string | undefined, theme: Theme, preview?: PreviewResult): Text {
	let title = theme.fg("toolTitle", theme.bold("edit"));
	if (path) title += " " + theme.fg("muted", path);
	if (preview && !preview.error) {
		title += " ";
		title += theme.fg("toolDiffAdded", `+${preview.additions}`);
		title += "/";
		title += theme.fg("toolDiffRemoved", `-${preview.deletions}`);
	}
	return new Text(title, 0, 0);
}

function messageBox(message: string, theme: Theme, bg: "toolSuccessBg" | "toolErrorBg"): Component {
	const out = box(theme, bg);
	out.addChild(new Text(message, 0, 0));
	return out;
}

function previewFromDetails(details: EditDetails): PreviewResult | null {
	const patch = details.patch ?? details.diff;
	if (!patch) return null;

	const hunks = parseUnifiedPatch(patch);
	const counts = countPatchLines(hunks);
	return {
		hunks,
		rows: pairLines(hunks),
		...counts,
		diff: details.diff,
		patch: details.patch,
	};
}

function fallbackUnified(diff: string, theme: Theme): Component {
	const out = box(theme, "toolSuccessBg");
	let rendered = diff;
	try {
		rendered = renderDiff(diff);
	} catch {
		// Standalone validation can run before Pi initializes its global theme.
	}
	out.addChild(new Text(rendered, 0, 0));
	return out;
}

export default function (pi: ExtensionAPI) {
	const base = createEditToolDefinition(process.cwd());

	pi.registerTool({
		...base,
		name: "edit",
		renderShell: "self",

		async execute(toolCallId, params, signal, onUpdate, ctx) {
			const tool = createEditTool(ctx.cwd);
			return tool.execute(toolCallId, params, signal, onUpdate);
		},

		renderCall(args: EditArgs, theme, context) {
			if (context.executionStarted) return new Container();

			const state = context.state as EditDiffState;
			const out = box(theme, state.preview && !state.preview.error ? "toolSuccessBg" : "toolPendingBg");
			out.addChild(header(args?.path, theme, state.preview));

			if (!context.argsComplete || !isRenderableArgs(args)) return out;

			const key = argsKey(args);
			if (state.previewKey !== key) {
				state.preview = undefined;
				state.previewError = undefined;
				state.previewKey = key;
				state.pending = false;
			}

			if (!state.preview && !state.pending) {
				state.pending = true;
				void computeOwnPreview(args.path, args.edits, context.cwd).then((preview) => {
					if (state.previewKey !== key) return;
					state.preview = preview;
					state.previewError = preview.error;
					state.pending = false;
					context.invalidate();
				});
			}

			if (state.preview && !state.preview.error && state.preview.hunks.length > 0) {
				out.addChild(
					new DiffRenderer(state.preview, theme, {
						expanded: context.expanded,
						diffText: state.preview.diff,
					}),
				);
			}

			return out;
		},

		renderResult(result, options, theme, context) {
			if (context.isError) {
				return messageBox(textFromResult(result) || "Edit failed", theme, "toolErrorBg");
			}

			const details = result.details as EditDetails | undefined;
			if (!details) return messageBox("Applied successfully", theme, "toolSuccessBg");
			if (!details.diff && !details.patch) return messageBox("No changes", theme, "toolSuccessBg");

			try {
				const preview = previewFromDetails(details);
				if (!preview) return messageBox("Applied successfully", theme, "toolSuccessBg");
				if (preview.hunks.length === 0) return messageBox("No changes", theme, "toolSuccessBg");

				const out = box(theme, "toolSuccessBg");
				out.addChild(header((context.args as EditArgs)?.path, theme, preview));
				out.addChild(
					new DiffRenderer(preview, theme, {
						expanded: options.expanded,
						diffText: details.diff,
					}),
				);
				return out;
			} catch {
				const diff = details.diff ?? details.patch ?? "";
				if (!diff.trim()) return messageBox("No changes", theme, "toolSuccessBg");
				return fallbackUnified(diff, theme);
			}
		},
	});
}

export function truncatePathForHeader(path: string, width: number): string {
	return truncateToWidth(path, Math.max(1, width - 6), "…");
}
