# FinTracker

Personal finance tracker that imports bank CSVs, auto-categorizes transactions, and provides filtering/export capabilities. All data stays in your browser via LocalStorage.

## Features

- **Multi-bank CSV import** with automatic format detection
- **Auto-categorization** of transactions based on description keywords
- Filter by date range, category, or free text search
- Financial summary (income, expenses, net balance)
- Manual transaction entry with custom categories
- Export filtered transactions to CSV
- Bulk select and delete transactions
- Duplicate detection across imports

## Supported Banks

| Bank | Format |
|------|--------|
| American Express | `Date,Date Processed,Description,Amount` |
| Mastercard | `Description,Type,Card Holder Name,Date,Time,Amount` |
| TD Bank | No header row — `Date,Description,Debit,Credit,Balance` |
| Simplii | `Date, Transaction Details, Funds Out, Funds In` |
| Bradesco (Brazil) | Semicolon-delimited, BRL amounts converted to CAD |
| FinTracker export | Re-import previously exported files |

## Tech Stack

Vanilla JavaScript (ES modules), HTML, and CSS — no frameworks, no build step, no runtime dependencies.

## Running

```bash
npm install   # first time only
npx serve . -l 3000
```

Open http://localhost:3000. Data persists in localStorage across sessions.

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
```

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
  state.js            # shared mutable state (transactions, sort, filters)
  dom.js              # DOM element references
  utils.js            # CSV line parsing, BRL-to-CAD conversion, HTML escaping
  category-engine.js  # generic category keywords, auto-categorization logic (no DOM deps)
  personal-keywords.example.js  # template for optional gitignored personal-keywords.js
  categories.js       # loads keyword map, wraps categorizer, category dropdowns, UI handlers
  storage.js          # LocalStorage load/save
  transactions.js     # transaction CRUD, filtering, deduplication
  ui.js               # rendering, sorting, summary updates
  import-export.js    # CSV import orchestration (registry-based), export
  events.js           # event listener wiring
  parsers/            # format-specific CSV parsers (one per bank + registry)
tests/
  helpers/            # test setup and DOM fixtures
  fixtures/           # static module fixtures loaded by tests
  parsers/            # parser-specific tests (one per parser + registry)
  *.test.js           # unit and integration tests (one per module)
tools/
  category-benchmark/ # category match benchmark utility
index.html
styles.css
```
