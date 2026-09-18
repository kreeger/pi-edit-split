# Changelog

## [0.2.0](https://github.com/kreeger/pi-edit-split/compare/v0.1.0...v0.2.0) (2026-09-18)

### Features

* add agent wayfinding docs ([803079e](https://github.com/kreeger/pi-edit-split/commit/803079ea0529ad661c917ed4c8809b97b55229bb))
* Add extended diff feature ([#1](https://github.com/kreeger/pi-edit-split/issues/1)) ([005d9f0](https://github.com/kreeger/pi-edit-split/commit/005d9f04e411ca7f6475371c071f44e2e058ab09))
* Prepare for open-source release ([6eb5e6f](https://github.com/kreeger/pi-edit-split/commit/6eb5e6f0325daf54412e8875da5cef853f25f3b8))
* support always showing full edit diffs ([#3](https://github.com/kreeger/pi-edit-split/issues/3)) ([3bb5b9b](https://github.com/kreeger/pi-edit-split/commit/3bb5b9b195bfab7436b34526b1b53fbfbe006ca5))

## [Unreleased]

### Changed

- Expanded diff view now renders every diff row instead of capping at 50 lines.

## [0.1.0] — 2026-06-18

### Added

- Initial release of pi-edit-split
- Side-by-side diff preview for the edit tool
- Unified diff and compact rendering modes
- Fuzzy text matching for typographic character normalization
- BOM-aware file reading
- Line-by-line diff with LCS-based comparison
- Responsive rendering (split, unified, compact based on terminal width)
