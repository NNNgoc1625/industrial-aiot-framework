# Changelog

The dated entries below are development milestones documented from this work session, not
published releases or a substitute for Git commit history. All milestones were worked on
2026-10-23 and they were first submitted on GitHub on 2026-10-29; the order describes the actual implementation progression.

## 0.1.0-dev.1 - 2026-10-23

### Frontend foundation

- Added the React and TypeScript operator app shell and feature-based project structure.
- Added live monitoring for CV source health, observations, metrics, and recent events.
- Added event details with available snapshot and clip evidence links.
- Added the shared CV API client, typed DTOs, runtime response checks, configurable API URL,
  explicit demo mode, and API error states.
- Added local-only validation for event and sensor CSV, JSON, JSONL, and NDJSON records, with a
  downloadable report.

## 0.1.0-dev.2 - 2026-10-24

### UI organization and readability

- Grouped stylesheet rules under component-oriented section headers.
- Formatted CSS rules and declarations into readable multiline blocks.
- Kept responsive styles grouped by screen-size breakpoint.

## 0.1.0-dev.3 - 2026-10-24

### Data examples and code documentation

- Added block comments for complex codes

## 0.1.0-dev.4 - 2026-10-24

### Team setup and contribution guidance

- Documented how to clone the CV API and frontend and run them together.
- Added API host/port, LAN connectivity and local-network safety guidance.
- Documented Conventional Commit message types and examples.
