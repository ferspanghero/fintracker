# v3 Implementation Plan — Balance Sheet, Settings & Backup

## Goal

Make FinTracker the single place where the monthly money picture lives. Transactions stay as they are. A new **Balance Sheet** tab replaces the external expense workbook and the hand-maintained balance-sheet spreadsheet: it combines the per-month asset balances you enter with income and spending calculated from transactions. A **Settings** tab owns exchange rates, the one category list, and the asset definitions, and a **Backup / Restore** file captures all app data.

## User Experience

### Layout

The page keeps today's header and adopts a **dark theme** (same Arial type, spacing and green/red/blue accents, dark surfaces). Under the header, three tabs:

| Tab | Content |
|---|---|
| **Transactions** (default) | Today's view, unchanged in layout: Import / Filter / Actions boxes, Summary cards, transactions table, CSV export of whatever is filtered. |
| **Balance Sheet** | Year selector + one grid per year (months as columns) + an Indicators panel. |
| **Settings** | Exchange Rates, Categories, Assets, Backup & Restore. |

All UI text is English. Category names stay as they are in the data (Portuguese) — they are user data, not UI copy.

### Transactions tab

- Import works as today (auto-detect, duplicate detection, ignore list). The result is shown in a dialog styled like the existing Add Transaction modal instead of `alert()`:

  ```
  Import complete
  Imported 151 transactions from 4 files:
    • 2026-08: 3 added
    • 2026-09: 142 added
    • 2026-10: 6 added
  212 duplicates skipped · 9 matched the ignore list · 0 errors
  ```

- Every category dropdown (filter, inline row editor, Add Transaction form) reads the Settings category list. "+ Add New Category" in the form adds to that same list, with the same validation as Settings.

### Balance Sheet tab

```
Year [2026 ▾]   Balances in each asset's own currency; totals in CAD. Click a balance to edit.

2026                 │ Jan      │ Feb      │ … │ Sep      │ Oct        │ Nov  │ Dec  ║ Total │ Average │ Prev. year avg │ Diff %
                     │ ✓ Closed │ ✓ Closed │   │ ✓ Closed │ Open       │ Open │ Open ║
                     │ [Reopen] │ [Reopen] │   │ [Reopen] │[Copy prev.]│      │      ║
ASSETS (END OF MONTH)
  <asset> [BRL]      │ 5,909    │ 6,120    │ … │ 12,206   │ ·          │ ·    │ ·    ║
  <asset> [USD]      │ …
  <asset> [CAD] archived (only in years it had a balance)
Net worth (CAD)      │ $…       │ $…       │ … │ $…       │            │      │      ║
INCOME
  Total income       │ …        │          │   │          │            │      │      ║ …     │ …       │ …              │ +x.x%
EXPENSES
  <one row per expense category in Settings, Sem Categoria highlighted when non-zero>
  Total expenses     │ …
Net income           │ …

Indicators 2026: Net worth at start of year · Current net worth · Net worth change ($ and %) · Total income ·
Total expenses · Total saved · Investment returns · Saving rate · Expense change vs last year
```

- **Closed month:** green header marked "✓ Closed" with a Reopen button and a faint green column tint. **Open month:** grey header marked "Open"; its balances render dim italic. Closing only changes the visual state and whether the month counts in **Average**. Balances stay editable; import is never affected.
- **Balance cell:** click to edit; the value is in the asset's currency, may be negative, and blank clears it. Cells show whole units; hovering shows the exact value and its CAD equivalent.
- **Copy prev.:** shown on the first month up to the current one that has no balances while the month before it does. It copies that month's balances for every non-archived asset.

### Settings tab

- **Exchange Rates:** editable USD → CAD and BRL → CAD fields (saved on change; positive numbers only) and a **Refresh Rates** button that pulls the latest Bank of Canada daily rate for both. A note shows the rate date and when it was refreshed. On failure: "Couldn't reach the Bank of Canada. Rates unchanged."
- **Categories:** expense and income chips. Add (trimmed, non-empty, unique per type, case-insensitive); × removes, disabled while any transaction uses the category (tooltip shows the count). Sem Categoria is fixed.
- **Assets:** table of name, currency (CAD / USD / BRL) and archived. Add, rename (unique, non-empty), change currency, archive/unarchive. Never deleted.
- **Backup & Restore:** **Download Backup** saves `fintracker-backup-YYYY-MM-DD.json`. **Restore from File…** validates the file, shows a summary dialog ("3,643 transactions, 25 assets, 21 months of balances. This replaces all current data."), and replaces everything on confirm. An invalid file lists what is wrong and changes nothing.

### Primary workflow (monthly close)

1. Download each provider's CSV and import them all on the Transactions tab; read the per-month summary.
2. Fix categories and delete unwanted rows as today.
3. On Balance Sheet, click **Copy prev.** for the month, then overwrite each balance from the providers' sites. Refresh rates in Settings if wanted.
4. Review the month's income, expense rows and indicators; click **Close**.
5. **Download Backup** (and optionally export the all-time CSV) and keep it somewhere safe.

## Architecture

```
index.html ─ tabs ─┬─ Transactions panel (existing DOM)
                   ├─ Balance Sheet panel ── balance-sheet-ui.js ──► balance-sheet.js (pure model)
                   └─ Settings panel ─────── settings-ui.js ───────► settings.js (pure rules)
                                                                     rates.js (BoC fetch + parse)
                                                                     backup.js (build + validate)
state.js:  transactions[] · balances{} · closedMonths[] · settings{}   (single in-memory copy)
storage.js: the only LocalStorage reader/writer (keys: transactions, settings, balances, closedMonths)
categories.js: dropdowns + categorizer, both reading settings.categories
import-export.js: passes { rates } to parsers; returns per-month counts for the dialog
```

Pure modules (`balance-sheet.js`, `settings.js`, `rates.js`, `backup.js`) take data as arguments and have no DOM access, mirroring `category-engine.js`. UI modules render from state and call `saveAndRefresh()`-style helpers.

### Data model

```js
// LocalStorage "settings"
{
  version: 1,
  rates: { USD: 1.4271 | null, BRL: 0.2860 | null, date: '2026-10-09' | null, refreshedAt: ISO | null },
  categories: { expense: ['Casa', …, 'Sem Categoria'], income: ['Trabalho', …, 'Sem Categoria'] },
  assets: [{ id: 'uuid', name: 'Example', currency: 'CAD' | 'USD' | 'BRL', archived: false }]
}
// LocalStorage "balances" — native amounts; absent key = blank cell
{ '2026-09': { '<assetId>': 1234.56 } }
// LocalStorage "closedMonths"
['2026-01', '2026-02']
// LocalStorage "transactions" — unchanged (CAD, positive amounts)
```

- **No seed.** A fresh install starts with `categories` containing only `Sem Categoria` in each type, no assets and null rates. The code's keyword map becomes a catalog only; `defaultCategories` is removed.
- The old `categories` LocalStorage key is no longer read; Restore clears it.

### Backup file

```js
{
  app: 'fintracker', version: 1, exportedAt: ISO,
  settings: { … as above … },
  transactions: [{ date: ISO, description, amount, type, category, account }],
  balances: { 'YYYY-MM': { assetId: number } },
  closedMonths: ['YYYY-MM']
}
```

Validation (all errors collected, none applied on failure): `app === 'fintracker'`; `version === 1`; settings shape (finite positive or null rates; category arrays of non-empty unique strings each containing `Sem Categoria`; assets with unique ids and names and a supported currency); every transaction has a parseable date, non-empty description, finite non-negative amount, `type` in income/expense, a category string present in the settings list for its type, and an account string; balance keys match `^\d{4}-(0[1-9]|1[0-2])$`, inner keys are known asset ids, values finite; `closedMonths` are valid month keys without duplicates.

## Phase 1 — Settings, state & storage

- `js/state.js`: add `balances`, `closedMonths`, `settings` exports alongside `transactions`; add `replaceAll(data)` used by Restore.
- `js/settings.js` (pure): `emptySettings()`, `addCategory(settings, type, name)`, `removeCategory(settings, type, name, transactions)`, `addAsset(settings, name, currency, idFn)`, `renameAsset`, `setAssetCurrency`, `setAssetArchived`, `setRate(settings, currency, value)`. Each returns `{ ok: true }` or `{ ok: false, error: '<user-facing message>' }` and mutates only on success.
- `js/storage.js`: load/save the four keys; missing `settings` → `emptySettings()`; Date rehydration for transactions as today; quota error handling as today.
- `js/categories.js`: drop the local `categories` copy; dropdowns read `settings.categories`; the categorizer only returns categories present in `settings.categories` (falls through to `UNCATEGORIZED`; the Reembolso fallback applies only when `Reembolso` exists).
- `js/category-engine.js`: remove `defaultCategories`; add pure `restrictKeywords(keywords, allowed)`.
- `js/transactions.js`: "+ Add New Category" uses `addCategory` and shows its error.
- `js/parsers/fintracker.js`: `afterParse` registers unknown categories via `addCategory` on `settings`.

## Phase 2 — Rates & import

- `js/rates.js`: `BOC_URL = 'https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXBRLCAD/json?recent=1'`; pure `parseBocResponse(json)` → `{ USD, BRL, date }` from the last observation (throws on missing or non-numeric values); `fetchLatestRates(fetchFn = fetch, timeoutMs = 10000)` using `AbortController`.
- `js/utils.js`: remove `BRL_TO_CAD_RATE`; `BRLtoCAD(amount, rate)`.
- Parser contract: `parseLine(line, ctx)` where `ctx = { rates }`; only Bradesco reads it. If the BRL rate is null the Bradesco import fails up front with "Set the BRL → CAD rate in Settings before importing Bradesco files."
- `js/import-export.js`: pass `{ rates: settings.rates }` to `parseLine`; pure `summarizeByMonth(addedTransactions)` → `[{ month: 'YYYY-MM', count }]` sorted ascending; show the result dialog (new `#import-result-modal`) instead of `alert()`.

## Phase 3 — Balance Sheet

### Model (`js/balance-sheet.js`, pure)

`buildYear({ year, transactions, balances, closedMonths, settings, today })` returns:

- `months[12]`: `{ key, closed, hasBalances, canCopyPrevious }`
- `assetRows`: assets visible this year — any balance entry in the year, or not archived and `year >= today's year` — each with 12 native values (`null` = blank) and 12 CAD values.
- `netWorth[12]`: Σ native × rate (CAD = 1) for months with ≥1 entry; `null` otherwise; `missingRates` lists currencies used without a rate (net worth shows "—" plus a "Set rates in Settings" note).
- `income` and one `expense` row per `settings.categories.expense`, plus `totalExpenses` and `netIncome`. Monthly values cover months ≤ the current month (by local transaction date), `null` after. Each flow row carries `total`, `average` (mean over the year's closed months), `prevAverage` (mean over the previous year's closed months, `null` if none), `diffPct` (`average / prevAverage − 1`, `null` when undefined).
- `indicators`: `startNetWorth` (latest month with balances before the year), `currentNetWorth` (latest month with balances in the year), `change`, `changePct`, `totalIncome`, `totalExpenses`, `saved`, `returns = change − saved`, `savingRate = saved / totalIncome`, `expenseChangePct` (total-expenses `diffPct`).
- Helpers: `copyPreviousMonth(balances, key, settings)`, `setBalance(balances, key, assetId, raw)` (parses, validates, deletes on blank), `toggleClosed(closedMonths, key)`.

### UI (`js/balance-sheet-ui.js`)

- Year `<select>` from the years that have balances or transactions plus the current year; defaults to the current year.
- Renders the grid and indicators from `buildYear`; inline cell editing (Enter/blur saves, Escape cancels, invalid input shows a message under the grid); Close/Reopen and Copy prev. buttons; all text through `escapeHTML`.
- Re-renders on tab activation and after any data change.

## Phase 4 — Settings UI, backup & theme

- `js/settings-ui.js`: rates form + Refresh (button disabled while fetching), category chips + add form, assets table + add form, Backup download (Blob + `<a download>`), Restore (file input → `validateBackup` → summary dialog → `replaceAll` + save + re-render everything).
- `js/backup.js` (pure): `buildBackup(state, now)` and `validateBackup(obj)` → `{ ok, errors[], data }`.
- `js/tabs.js`: `role="tab"` buttons toggling `hidden` on panels; Transactions selected on load.
- `index.html`: tabs, three panels (the current content moves into the Transactions panel unchanged), import-result and restore-confirm modals.
- `styles.css`: dark palette via CSS custom properties; tab, grid, chip and Settings styles. Same structure and class names as today.
- `js/main.js`, `js/events.js`, `js/dom.js`: wire the new modules; keep the `document.readyState` register-or-run branch.

## Phase 5 — End-to-end tests (Playwright)

- `package.json`: devDependency `@playwright/test` pinned to `1.60.0` (matches the browser builds already cached locally, so no browser download); script `"test:e2e": "playwright test"`.
- `playwright.config.js`: `testDir: 'tests/e2e'`, Chromium only, `webServer` = `node tests/e2e/static-server.mjs` on port 3100 (a ~25-line `node:http` static server, no dependency).
- `vitest.config.js`: exclude `tests/e2e/**`. `.gitignore`: `test-results/`, `playwright-report/`.
- Specs seed LocalStorage through `page.addInitScript` with synthetic data only, and mock the Bank of Canada call with `page.route`.

## Phase 6 — One-time history import (outside the repo)

A throwaway script in the session scratchpad, never committed (it reads personal workbooks):

1. Input: a Backup downloaded from the v3 app plus the yearly balance-sheet workbooks from the start of FinTracker data onward.
2. Output: a Backup JSON with `settings.categories` (current category list), `settings.assets` (one per workbook asset row, currency from the row's conversion formula, archived when the latest balance is zero), current Bank of Canada rates, `balances` for every closed workbook month, and `closedMonths`.
3. Checks: every native balance equals its workbook cell; per-month income and expense totals from transactions equal the workbook's linked values; any cell mixing currencies is reported for a manual decision.
4. The user restores the file in the app.

## Phase 7 — Docs

- `README.md`: tabs, Balance Sheet, Settings, Backup/Restore, E2E command; replace "works with zero config" with the fresh-install behaviour (only Sem Categoria until categories are added).
- `CLAUDE.md`: new modules, storage keys, parser `ctx`, the single category list, E2E command.
- `project_files/overview.md`: architecture, data model, parser contract (`parseLine(line, ctx)`), storage.

## File Manifest

```
index.html                       (modified: tabs, panels, modals)
styles.css                       (modified: dark theme, new components)
playwright.config.js             (new)
package.json                     (modified: @playwright/test 1.60.0, test:e2e)
vitest.config.js                 (modified: exclude tests/e2e)
.gitignore                       (modified: Playwright output)
js/
  balance-sheet.js               (new, pure)
  balance-sheet-ui.js            (new)
  settings.js                    (new, pure)
  settings-ui.js                 (new)
  rates.js                       (new)
  backup.js                      (new, pure)
  tabs.js                        (new)
  state.js storage.js categories.js category-engine.js import-export.js
  transactions.js events.js dom.js main.js ui.js utils.js   (modified)
  parsers/bradesco.js parsers/fintracker.js                  (modified)
tests/
  balance-sheet.test.js balance-sheet-ui.test.js settings.test.js settings-ui.test.js
  rates.test.js backup.test.js tabs.test.js                  (new)
  existing *.test.js + helpers/dom-fixture.js                (updated)
  e2e/static-server.mjs  e2e/*.spec.js                       (new)
README.md  CLAUDE.md  project_files/overview.md              (modified)
```

## Verification

1. `npm test` — all unit and integration tests pass.
2. `npm run test:coverage` — lines/statements/functions ≥ 90%, branches ≥ 85%.
3. `npm run test:e2e` — all Playwright specs pass.
4. `node tools/category-benchmark/run-category-benchmark.mjs` — match rate unchanged (the benchmark uses the full keyword catalog).
5. Manual: `npx serve . -l 3000` (or `python3 -m http.server 3000`), restore the history backup, compare a few months of income/expenses and native balances against the workbooks.

## Test Scenarios

- **E1** — Tabs: page loads → Transactions tab selected, others hidden → clicking each tab shows only its panel.
- **E2** — Per-month import summary: CSV with rows in two months, one duplicate, one ignore-list row → import → dialog lists both months with counts, "1 duplicates skipped · 1 matched the ignore list".
- **E3** — Bradesco uses the Settings rate: BRL rate 0.3 → import a Bradesco row of R$ 100,00 → stored amount 30.00 CAD.
- **E4** — Bradesco without a rate: BRL rate null → import a Bradesco file → error message, nothing added.
- **E5** — Enter a balance: asset (USD), USD rate 1.5 → type 100 in a month → cell shows 100, net worth for that month 150.
- **E6** — Clear a balance: existing value → clear and confirm → cell blank, net worth blank when the month has no other entries.
- **E7** — Invalid balance: type "abc" → message shown, value unchanged.
- **E8** — Copy previous month: previous month has balances for two active assets and one archived → Copy prev. → two values copied, archived one not.
- **E9** — Close / Reopen: month with balances → Close → header "✓ Closed", Average now includes that month → Reopen → reverts.
- **E10** — Averages and Diff %: two closed months with expenses 100 and 200, previous year closed average 100 → Average 150, Diff % +50.0%.
- **E11** — Expense rows follow Settings: add category "Pets" in Settings → Balance Sheet shows a Pets row and the filter dropdown lists Pets.
- **E12** — Sem Categoria highlight: an uncategorized expense in a month → the Sem Categoria row is highlighted.
- **E13** — Archived asset visibility: asset archived with balances only in the previous year → shown in that year, hidden in the current year.
- **E14** — Indicators: previous-year December net worth 1,000, current latest 1,200, income 500, expenses 200 → change 200 (+20.0%), saved 300, returns −100, saving rate 60.0%.
- **E15** — Refresh rates success: Bank of Canada mocked with USD 1.4 / BRL 0.27 → Refresh → fields updated, note shows the rate date.
- **E16** — Refresh rates failure: mocked network error → message "Couldn't reach the Bank of Canada. Rates unchanged." and fields unchanged.
- **E17** — Remove category in use: category used by 3 transactions → × disabled with tooltip "Used by 3 transactions"; unused category → × removes it everywhere.
- **E18** — Duplicate category / asset names: add an existing name in different case → error shown, nothing added.
- **E19** — Change asset currency: CAD asset with balance 100, USD rate 1.5 → set currency USD → net worth for that month 150.
- **E20** — Backup → Restore round trip: seeded data → Download Backup → clear storage → Restore the file → confirm → identical transactions, settings, balances and closed months.
- **E21** — Restore invalid file: JSON with a balance pointing to an unknown asset id and a bad month key → both errors listed, data unchanged.
- **E22** — Restore cancel: valid file → summary dialog → Cancel → data unchanged.
- **E23** — Fresh install: empty LocalStorage → category lists contain only Sem Categoria, no assets, rates empty; importing a TD CSV categorizes every row as Sem Categoria.
- **E24** — Add New Category from the transaction form: name it, save → category appears in Settings and every dropdown.
- **E25** — Missing rate on the Balance Sheet: USD asset with a balance, USD rate empty → net worth "—" with "Set rates in Settings".

## Implementation Order

```
Phase 1 (state, settings, storage, categories) → Phase 2 (rates, import) → Phase 3 (balance-sheet model → UI)
                                                                         ↘ Phase 4 (settings UI, backup, tabs, theme)
Phase 3 + 4 → Phase 5 (E2E) → Phase 6 (history import, outside the repo) → Phase 7 (docs)
(balance-sheet.js, rates.js and backup.js are independent pure modules and can be built in any order after Phase 1)
```

## Out of Scope / Follow-ups

- SQL storage (storage stays behind `storage.js` so it can be swapped).
- Retirement/FIRE projections (the spreadsheet's second sheet), to be redesigned.
- Budgets / spending limits per category.
- LLM categorizer or a learned description → category map, with the keyword engine as fallback.
- Light-theme toggle; asset reordering; per-month historical exchange rates.
