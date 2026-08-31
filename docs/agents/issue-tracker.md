# Issue tracker: Local Markdown

Issues and specs for this repo live in `docs/issues/`, one Markdown file per
issue. Use YAML frontmatter for issue metadata.

## File format

Name each issue `<id>-<slug>.md`, where `id` is the next unused integer. Start
from `docs/issues/_template.md` and keep these frontmatter fields up to date:

- `id`: Numeric issue identifier.
- `title`: Short issue title.
- `status`: `open`, `in-progress`, or `closed`.
- `labels`: List of triage or topic labels.
- `assignee`: Person or agent responsible, or `null`.
- `created`: Creation date in `YYYY-MM-DD` format.

Keep the problem, desired outcome, acceptance criteria, and dated updates in the
Markdown body.

## Conventions

- **Create an issue**: Copy `_template.md` to the next available
  `<id>-<slug>.md` and fill in its frontmatter and body.
- **Read an issue**: Read its file from `docs/issues/`.
- **List open issues**: Search for `status: open` in `docs/issues/`.
- **Update an issue**: Edit its file, including its frontmatter when state or
  ownership changes.
- **Add an update**: Append a dated entry to the `Updates` section.
- **Close**: Set `status: closed` and append the resolution to `Updates`.
- **Triage**: Set or change `labels` in the YAML frontmatter.

## Pull requests as a triage surface

**PRs as a request surface: no.**
