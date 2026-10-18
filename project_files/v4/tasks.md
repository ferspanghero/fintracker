# v4 Tasks — Investments & FIRE

## Phase 1 — Settings model & storage

- [x] **S1**: `settings.js` — `SETTINGS_VERSION = 2`, `ASSET_TYPES` (with `taxedYearly`), `ASSET_CLASSES`, `migrateSettings`
- [x] **S2**: `settings.js` — `assetName`, `setAssetDetails`, `addAsset` with details; duplicate generated names rejected
- [x] **S3**: `settings.js` — `setHoldingSplit`, `setTargets` (sum 100), `setFireInput` (range checks, projection start/end years)
- [x] **S4**: `state.js` — `registeredRoom` export; `replaceAll` covers it
- [x] **S5**: `storage.js` — load/save `registeredRoom`, settings through `migrateSettings`, `saveRegisteredRoom()`
- [x] **S6**: `backup.js` — version 2 build/validate; version 1 accepted and migrated

## Phase 2 — FIRE model

- [x] **F1**: `balance-sheet.js` — export `aggregateByMonth` and `rateTable` (no behaviour change)
- [x] **F2**: `fire.js` — latest month, CAD values, missing rates, FI portfolio, non-reg share
- [x] **F3**: `fire.js` — last-12-months spending and saved, fixed-spending mode
- [x] **F4**: `fire.js` — stats and progress (FI number, SWR today, achieved, freedom days/calendar, still to fund)
- [x] **F5**: `fire.js` — projection from start to end year: actual (closed December), no-data, open and projected rows; FI year, "Reached", "Not reached by"
- [x] **F6**: `fire.js` — allocation (splits, drift, to reach target, Unclassified) and holdings

## Phase 3 — Registered room

- [x] **R1**: `registered-room.js` — `roomPeople`, `roomRows` with Left and warnings
- [x] **R2**: `registered-room.js` — `setRoomValue` parsing, years offered

## Phase 4 — UI

- [x] **U1**: `explanations.js` — texts map and `tip()` markup (`aria-describedby` + `role="tooltip"`)
- [x] **U2**: `index.html` / `dom.js` / `tabs.js` / `main.js` — Investments & FIRE tab and panel wiring
- [x] **U3**: `fire-ui.js` — stats, progress, projection, allocation, holdings, assumptions; empty and missing-rate states
- [x] **U4**: `fire-ui.js` — registered room table: year selector, inputs saving on change, warnings
- [x] **U5**: `settings-ui.js` — asset detail columns and add form; read-only generated name; Hide archived toggle (on by default)
- [x] **U6**: `settings-ui.js` — Asset classes table (holdings + Target) and FIRE assumptions form
- [x] **U7**: `styles.css` — row kinds, FI badge, progress bar, tips (1 s hover delay, focus, Escape)

## Phase 5 — End-to-end tests

- [x] **E1**: `tests/e2e/investments.spec.js` — scenarios E1–E16, E20–E23, E27
- [x] **E2**: `tests/e2e/settings.spec.js` — scenarios E17–E19, E24–E26, E28

## Phase 6 — Docs

- [x] **D1**: `README.md` — new tab and Settings sections
- [x] **D2**: `CLAUDE.md` — new modules, storage key, settings migration
- [x] **D3**: `project_files/overview.md` — architecture, data model, backup version 2
- [x] **D4**: `project_files/backlog.md` — remove the Retirement / FIRE item

## Phase 7 — Milestone: history import 2017–2024 (after v4 ships)

- [ ] **H1**: Settle the open concerns in plan.md Phase 7 (transactions as monthly totals or individual rows, `.xls` files, asset mapping, rates, liabilities, categories)
- [ ] **H2**: One-off converter outside the repo: balance-sheet workbooks → assets, monthly balances, closed months
- [ ] **H3**: Converter: expense data → transactions with categories mapped to the current list
- [ ] **H4**: Merge onto a fresh backup of current data and settings → one version 2 backup in `resources/`; validate it with `validateBackup`
- [ ] **H5**: Restore it and check the 2017–2024 projection rows against the old workbooks
