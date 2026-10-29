# Industrial AIoT Operator UI

Feature-based React + TypeScript frontend for the team's on-prem monitoring prototype. It uses `aiot-stream-cv` read API and includes local-only event/sensor record validation. Uploaded files are processed in the browser and are not sent to a server.

## Run locally

### Workspace layout

Clone the frontend and CV API as **2 separate folders** under one workspace directory. 
Do not put `aiot-stream-cv` inside `frontend`.

```powershell
mkdir industrial-aiot
cd industrial-aiot
git clone https://github.com/quanpham071204/aiot-stream-cv.git
git clone https://github.com/NNNgoc1625/industrial-aiot-framework.git frontend
```

After cloning, the workspace should look like this:

```text
industrial-aiot/
  aiot-stream-cv/
  frontend/
```

### Start the CV API

Use Python 3.10 or newer. 
In one PowerShell terminal:

```powershell
cd industrial-aiot\aiot-stream-cv
python -m venv .venv
# Windows
  .\.venv\Scripts\Activate.ps1
~# or Linux
  source .venv/bin/activate
pip install -r requirements.txt
python scripts/download_assets.py
python run.py
```

The sample configuration starts the API on `127.0.0.1:8080`. Leave this terminal running.
Check that `http://127.0.0.1:8080/health` returns JSON before starting the frontend.

### Start the frontend

In a second PowerShell terminal:

```powershell
cd industrial-aiot\frontend
npm install
npm run dev
```

Open the local URL printed by Vite. By default, the UI calls `http://127.0.0.1:8080`, so the
frontend and API should be running on the same computer. Use `npm ci` instead of `npm install` when you want an install exactly matching the committed lockfile.

If the API runs on another computer or port, copy `.env.example` to `.env.local`, set
`VITE_API_BASE_URL` to the API's reachable address (for example `http://192.168.1.25:8080`)
and restart Vite in your terminal. For another computer on a LAN, the API must bind to an appropriate network interface and the host firewall must allow the port. The sample API has no authentication or TLS: only expose it on a trusted network, and do not forward it to the public internet.

Use the **Dữ liệu mẫu** toggle to preview the interface without a running API. The indicator explicitly marks this as demo data; API failures in live mode are shown instead of being replaced with sample values.

## Features

- **Monitoring**: source health, current observations, session metrics, recent events and event evidence.
- **Data validation**: client-side JSON, JSONL/NDJSON, and CSV checks for the current event contract or the project brief's common sensor-record shape; validation report can be downloaded.
- **Feature organization**: `src/features/monitoring`, `src/features/events`, and `src/features/data-validation`, with shared API types and client in `src/shared/api`.

Workflow editing, device control, event acknowledgement, and dataset upload are intentionally not presented as working controls: the current backend has no corresponding API. Validation is a local file check, not model-accuracy evaluation or image/video annotation review.

The proposed frontend/API contract and current endpoint details are documented in [API & Service Communication Contracts](../.github/modernize/assessment/engines/facts/api-service-contracts.md).

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) so commit history is consistent and easier to scan:

```text
<type>[optional scope]: <short description>
```

Use the imperative where practical, keep the summary concise and do not end it with a period.
Common types:

| Type | Use |
|---|---|
| `feat` | Add or change user-facing functionality |
| `fix` | Correct a bug |
| `docs` | Documentation-only changes |
| `style` | Formatting or styling without behavior changes |
| `refactor` | Restructure code without changing behavior |
| `test` | Add or update tests |
| `build` | Build system or dependency changes |
| `ci` | CI configuration changes |
| `chore` | Other maintenance |
| `perf` | Performance improvement |

Examples:

```text
feat(monitoring): add source health summary
fix(validation): reject duplicate CSV headers
docs(readme): explain local API setup
refactor(api): centralize response parsing
test(validation): cover malformed JSONL rows
```

For an incompatible change, add `!` after the type/scope or include a `BREAKING CHANGE:` footer, as described in the Conventional Commits specification:

```text
feat(api)!: rename event source field
```

## Changelog

Development milestones are summarized in [CHANGELOG.md](CHANGELOG.md). They are dated notes from the current work session, not published release tags; use Git history as the source for exact commit-level dates.

## Checks

```powershell
npm test
npm run build
```
