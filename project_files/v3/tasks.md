# v3 Tasks — Balance Sheet, Settings & Backup

## Phase 1 — Settings, state & storage

- [x] **S1**: `state.js` — add `balances`, `closedMonths`, `settings` exports and `replaceAll(data)`
- [x] **S2**: `settings.js` — `emptySettings`, category add/remove rules, asset add/rename/currency/archive, `setRate`; `{ ok, error }` results
- [x] **S3**: `storage.js` — load/save `transactions`, `settings`, `balances`, `closedMonths`; missing settings → `emptySettings()`
- [x] **S4**: `category-engine.js` — remove `defaultCategories`; add `restrictKeywords(keywords, allowed)`
- [x] **S5**: `categories.js` — dropdowns and categorizer read `settings.categories`; Reembolso fallback only when present
- [x] **S6**: `transactions.js` — "+ Add New Category" goes through `addCategory` and shows its error
- [x] **S7**: `parsers/fintracker.js` — `afterParse` registers unknown categories via `addCategory`

## Phase 2 — Rates & import

- [x] **R1**: `rates.js` — `BOC_URL`, `parseBocResponse`, `fetchLatestRates` with 10 s timeout
- [x] **R2**: `utils.js` — remove `BRL_TO_CAD_RATE`; `BRLtoCAD(amount, rate)`
- [x] **R3**: Parser contract `parseLine(line, ctx)`; Bradesco reads `ctx.rates.BRL`; null rate → up-front import error
- [x] **R4**: `import-export.js` — pass `{ rates }`; `summarizeByMonth`; import-result dialog replaces `alert()`

## Phase 3 — Balance Sheet

- [x] **B1**: `balance-sheet.js` — `buildYear`: months, visible asset rows, net worth, missing rates
- [x] **B1a**: Flow rows — income, one row per expense category, total expenses, net income; months ≤ current month only
- [x] **B1b**: Total, Average (closed months), Prev. year avg, Diff %
- [x] **B1c**: Indicators — start/current net worth, change, totals, saved, returns, saving rate, expense change
- [x] **B2**: `setBalance`, `copyPreviousMonth`, `toggleClosed` helpers
- [x] **B3**: `balance-sheet-ui.js` — year selector, grid render, inline cell editing, Close/Reopen, Copy prev., indicators panel, error message

## Phase 4 — Settings UI, backup & theme

- [x] **U1**: `backup.js` — `buildBackup`, `validateBackup` with collected errors
- [x] **U2**: `settings-ui.js` — rates form + Refresh (disabled while fetching, failure message)
- [x] **U3**: `settings-ui.js` — category chips (× disabled with usage tooltip) + add form
- [x] **U4**: `settings-ui.js` — assets table + add form
- [x] **U5**: `settings-ui.js` — Download Backup; Restore → validate → summary dialog → replace all + re-render
- [x] **U6**: `tabs.js` + `index.html` tabs, panels, import-result and restore-confirm modals
- [x] **U7**: `styles.css` dark theme + tab, grid, chip and Settings styles
- [x] **U8**: `main.js` / `events.js` / `dom.js` wiring; keep the readyState branch

## Phase 5 — End-to-end tests

- [x] **P1**: Install `@playwright/test@1.60.0` (dev); `test:e2e` script; `playwright.config.js`; `tests/e2e/static-server.mjs`
- [x] **P2**: `vitest.config.js` excludes `tests/e2e/**`; `.gitignore` Playwright output
- [x] **E1**: Tabs
- [x] **E2**: Per-month import summary
- [x] **E3**: Bradesco uses the Settings rate
- [x] **E4**: Bradesco without a rate
- [x] **E5**: Enter a balance
- [x] **E6**: Clear a balance
- [x] **E7**: Invalid balance
- [x] **E8**: Copy previous month
- [x] **E9**: Close / Reopen
- [x] **E10**: Averages and Diff %
- [x] **E11**: Expense rows follow Settings
- [x] **E12**: Sem Categoria highlight
- [x] **E13**: Archived asset visibility
- [x] **E14**: Indicators
- [x] **E15**: Refresh rates success
- [x] **E16**: Refresh rates failure
- [x] **E17**: Remove category in use
- [x] **E18**: Duplicate category / asset names
- [x] **E19**: Change asset currency
- [x] **E20**: Backup → Restore round trip
- [x] **E21**: Restore invalid file
- [x] **E22**: Restore cancel
- [x] **E23**: Fresh install
- [x] **E24**: Add New Category from the transaction form
- [x] **E25**: Missing rate on the Balance Sheet

## Phase 6 — One-time history import (outside the repo)

- [x] **H1**: Scratchpad script: app Backup + yearly workbooks → Backup JSON with categories, assets, rates, balances, closed months
- [x] **H2**: Checks — native balances equal workbook cells; monthly income/expense totals match; mixed-currency cells reported
- [x] **H3**: User restores the file in the app and spot-checks

## Phase 7 — Docs

- [x] **D1**: `README.md` — tabs, Balance Sheet, Settings, Backup/Restore, E2E command, fresh-install behaviour
- [x] **D2**: `CLAUDE.md` — modules, storage keys, parser `ctx`, single category list, E2E command
- [x] **D3**: `project_files/overview.md` — architecture, data model, parser contract, storage
