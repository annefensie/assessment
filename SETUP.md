# UMPI Assessment Design Tool — Setup Guide

## Architecture recap

- **Runtime:** Google Apps Script (deployed as a Web App)
- **Database:** Google Sheets (one spreadsheet, tabs as tables)
- **Frontend:** React 18 + Tailwind 2 loaded from CDN — no build step
- **Auth:** Google Workspace domain restriction (`@maine.edu`)
- **Version control:** This repo, pushed via `clasp`

---

## First-time setup (one developer machine)

### 1. Install clasp

```bash
npm install -g @google/clasp
clasp login
```

### 2. Create the Google Sheet database

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
2. Name it **UMPI Assessment DB** (or similar).
3. Copy the spreadsheet ID from the URL:
   `https://docs.google.com/spreadsheets/d/**SPREADSHEET_ID**/edit`

### 3. Create the Apps Script project

1. Go to [script.google.com](https://script.google.com) → New Project.
2. Name it **UMPI Assessment Tool**.
3. In Project Settings → Script Properties, add:
   - Key: `SPREADSHEET_ID`
   - Value: `<your spreadsheet ID from step 2>`
4. Copy the Script ID from Project Settings.
5. Update `.clasp.json` in this repo:

```json
{
  "scriptId": "YOUR_SCRIPT_ID_HERE",
  "rootDir": "./src"
}
```

### 4. Push the code

```bash
clasp push
```

> `clasp push` reads `rootDir = ./src` and uploads all `.gs` and `.html` files.

### 5. Initialize the database

1. Open the Apps Script editor at [script.google.com](https://script.google.com).
2. Select the `Setup.gs` file.
3. Run `setupAll()` (click the ▶ Run button).
4. Grant the required OAuth scopes when prompted.
5. Check the execution log — you should see table creation and framework data import messages.

### 6. Deploy the web app

1. In the Apps Script editor: **Deploy → New deployment**.
2. Type: **Web app**.
3. Execute as: **User accessing the web app**.
4. Who has access: **Only users in your Google Workspace domain** (or "Only myself" for testing).
5. Copy the deployment URL.

---

## Updating framework data

When the psychometrician updates `assessment_framework_expansion_updated.xlsx`:

```bash
python3 scripts/extract_framework.py path/to/assessment_framework_expansion_updated.xlsx
clasp push
```

Then in the Apps Script editor, run `refreshFrameworkCache()` (or redeploy).

---

## Development workflow

```bash
# Pull latest from Apps Script editor (if edited there)
clasp pull

# Push local changes
clasp push

# Open in Apps Script editor
clasp open
```

---

## Environment variables / Script Properties

| Property | Description |
|---|---|
| `SPREADSHEET_ID` | Google Sheet database ID |

---

## Demo data

Running `setupAll()` seeds 5 programs, 10 courses, ~22 CLOs, and 5 GLOs drawn
from UMPI catalog data. This is sufficient for the demo flow.

Replace demo data with real catalog data by running the catalog scraper
(Phase 1) and proposal PDF parser (Phase 2) after IT confirms Apps Script
deployment permissions.

---

## IT checklist (pending)

- [ ] Confirm Apps Script web app deployment is enabled in the UMS Google Workspace tenant
- [ ] Confirm `UrlFetchApp` to `catalog.umpi.edu` is acceptable
- [ ] Confirm service-account access to the Drive proposal folder (for Phase 2 PDF parser)

---

## File structure

```
/
├── appsscript.json         Apps Script manifest
├── .clasp.json             clasp project config (add your scriptId)
├── SETUP.md                This file
├── src/
│   ├── appsscript.json     Manifest copy (clasp reads from rootDir)
│   ├── FrameworkData.gs    Auto-generated embedded framework constants
│   ├── SheetDB.gs          Sheets database access layer
│   ├── Framework.gs        Recommendation engine
│   ├── PromptGen.gs        Prompt template generation
│   ├── Setup.gs            One-time DB init + demo seed
│   ├── Admin.gs            Admin-only server functions
│   ├── Code.gs             Web app entry point + all RPC endpoints
│   └── index.html          React + Tailwind frontend (single-page app)
├── data/
│   ├── framework_all.json  All sheets combined
│   ├── verbs.csv / .json
│   ├── behaviors.csv / .json
│   ├── tasks.csv / .json
│   ├── deliverables.csv / .json
│   ├── discipline_map.csv / .json
│   ├── ai_resistance.csv / .json
│   ├── sources.csv / .json
│   ├── program_disciplines.csv / .json
│   └── app_implementation_notes.csv / .json
└── scripts/
    ├── extract_framework.py   Regenerates data/ and FrameworkData.gs from xlsx
    └── create_sheet_db.js     Optional Node helper to verify Sheet access
```
