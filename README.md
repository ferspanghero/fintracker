# FinTracker

Personal finance tracker that imports bank CSVs, auto-categorizes transactions, and builds a monthly balance sheet from your transactions and the asset balances you enter. All data stays in your browser via LocalStorage.

## Features

The page has three tabs: **Transactions**, **Balance Sheet**, and **Settings**.

- **Multi-bank CSV import** with automatic format detection and a per-month summary of what was added
- **Auto-categorization** of transactions based on description keywords
- Filter by date range, category, or free text search
- Financial summary (income, expenses, net balance)
- Manual transaction entry with custom categories
- Export filtered transactions to CSV
- Bulk select and delete transactions
- Duplicate detection across imports
- Import ignore list for transfers between your own accounts (e.g. card payments), with optional private entries in the gitignored personal keywords file
- **Balance Sheet** per year: month-end asset balances (entered by hand, each in its asset's currency), net worth in CAD, income and one row per expense category, averages over closed months compared with the previous year, and yearly indicators (net worth change, saving rate, investment returns)
- **Close / Reopen** a Balance Sheet month to mark it reviewed and count it in the averages; imports are never affected
- **Settings**: USD → CAD and BRL → CAD rates (editable, or refreshed from the Bank of Canada), the single category list used everywhere, and asset definitions (assets are archived, never deleted)
- **Backup / Restore** of all app data as one JSON file; a restore is validated first and replaces everything only after you confirm

## Supported Banks

| Bank | Format |
|------|--------|
| American Express | `Date,Date Processed,Description,Amount` |
| Mastercard | `Description,Type,Card Holder Name,Date,Time,Amount` |
| TD Bank | No header row — `Date,Description,Debit,Credit,Balance` |
| Simplii | `Date, Transaction Details, Funds Out, Funds In` |
| Bradesco (Brazil) | Semicolon-delimited, BRL amounts converted to CAD with the Settings rate |
| FinTracker export | Re-import previously exported files |

## Tech Stack

Vanilla JavaScript (ES modules), HTML, and CSS — no frameworks, no build step, no runtime dependencies.

## Running

```bash
npm install   # first time only
npx serve . -l 3000
```

Open http://localhost:3000. Data persists in localStorage across sessions.

A fresh install starts with only the `Sem Categoria` category, no assets, and no exchange rates: add categories, assets, and rates in **Settings** (or restore a backup) before importing. Bradesco imports need the BRL → CAD rate.

## Tests

Install dev dependencies first:

```bash
npm install
```

Then:

```bash
npm test              # run tests once
npm run test:watch    # run in watch mode
npm run test:coverage # run with coverage report
npm run test:e2e      # end-to-end tests in Chromium (Playwright)
```

End-to-end scenarios are listed under "Test Scenarios" in the latest `project_files/v*/plan.md`.

## Category Match Benchmark

Compares the auto-categorization engine against a ground-truth CSV of manually categorized transactions. Reports match rate, mismatches (with triggering keywords), and uncategorized entries.

```bash
node tools/category-benchmark/run-category-benchmark.mjs [suffix]
```

Outputs a summary to the console and writes timestamped results to `tools/category-benchmark/`:

```bash
node tools/category-benchmark/run-category-benchmark.mjs              # category-benchmark_2026-03-10-16-50.json
node tools/category-benchmark/run-category-benchmark.mjs keyword_fix  # category-benchmark_2026-03-10-16-50_keyword_fix.json
```

```
tools/category-benchmark/
  all_time_controle_de_gastos.csv   # ground-truth transactions (manually categorized)
  run-category-benchmark.mjs        # benchmark script
  category-benchmark_*.json         # output (generated, timestamped)
```

## Project Structure

```
js/
  main.js             # app initialization
  state.js            # shared mutable state (transactions, settings, balances, closed months, sort, filters)
  dom.js              # DOM element references
  utils.js            # CSV line parsing, BRL-to-CAD conversion, HTML escaping
  category-engine.js  # generic category keywords, auto-categorization logic (no DOM deps)
  personal-keywords.example.js  # template for optional gitignored personal-keywords.js
  categories.js       # loads keyword map, wraps categorizer, category dropdowns, UI handlers
  ignore-rules.js     # import ignore list: generic + personal prefixes, starts-with matcher (no DOM deps)
  storage.js          # LocalStorage load/save
  settings.js         # rules for rates, categories, and assets (no DOM deps)
  settings-ui.js      # Settings tab, Backup / Restore
  balance-sheet.js    # Balance Sheet model: balances, net worth, monthly flows, indicators (no DOM deps)
  balance-sheet-ui.js # Balance Sheet tab rendering and editing
  backup.js           # backup file format and validation (no DOM deps)
  rates.js            # Bank of Canada exchange-rate fetch
  tabs.js             # tab switching
  transactions.js     # transaction CRUD, filtering, deduplication
  ui.js               # rendering, sorting, summary updates
  import-export.js    # CSV import orchestration (registry-based), export
  events.js           # event listener wiring
  parsers/            # format-specific CSV parsers (one per bank + registry)
tests/
  helpers/            # test setup and DOM fixtures
  fixtures/           # static module fixtures loaded by tests
  parsers/            # parser-specific tests (one per parser + registry)
  e2e/                # Playwright end-to-end specs and their static server
  *.test.js           # unit and integration tests (one per module)
tools/
  category-benchmark/ # category match benchmark utility
index.html
styles.css
playwright.config.js
```
