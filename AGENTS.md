# Project guidance

This repository uses the [Everything Claude Code (ECC)](https://github.com/affaan-m/ECC) workflow through Codex's native `ecc@ecc` plugin.

## Working approach

- For substantial changes, clarify the goal and inspect the existing architecture before editing.
- For bug fixes and features, add or update focused tests when the project has a test setup; run relevant checks before reporting completion.
- Review changes for correctness, security, and maintainability before finishing.
- Validate untrusted input at system boundaries, avoid hard-coded secrets, and handle errors explicitly.
- Follow the conventions and tooling established by this repository as it grows.

## ECC skills

Use the installed ECC skills when relevant, especially `tdd-workflow`, `verification-loop`, `security-review`, and `code-review`. The plugin is installed in the active Codex profile; it is not vendored into this repository.
