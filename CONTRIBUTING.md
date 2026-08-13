# Contributing to pi-edit-split

Thanks for your interest in pi-edit-split! This document covers how to
contribute, set up a development environment, and get your changes
reviewed and merged.

## Getting started

1. Fork the [repository](https://git.kree.gr/kreeger/pi-edit-split) on
   git.kree.gr.
2. Clone your fork:
   ```bash
   git clone https://git.kree.gr/YOUR_USERNAME/pi-edit-split.git
   cd pi-edit-split
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the tests to verify everything works:
   ```bash
   npm test
   ```

## Development workflow

This project uses [Vitest](https://vitest.dev/) for testing. Tests live
alongside source files (`.test.ts`). Run the full suite before pushing:

```bash
npm test
```

## Submitting changes

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-change
   ```
2. Make your changes and commit with a descriptive message.
3. Push your branch and open a pull request.

## Code style

- Follow the existing TypeScript style (strict mode, ESNext)
- Keep functions focused and single-purpose
- Add tests for new functionality
- Update CHANGELOG.md under "Unreleased" for user-facing changes

## Questions?

Open an issue or reach out to the maintainer.
