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

Vanilla JavaScript, HTML, and CSS — no frameworks, no build step, no runtime dependencies.

## Running

Open `index.html` in a browser. That's it.

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

225 tests across 8 test files. Coverage thresholds: 90% statements/lines/functions, 85% branches.

### Test structure

```
tests/
  helpers/
    setup.js          # loads source files, resets state between tests
    dom-fixture.js    # minimal HTML fixture for jsdom
  utils.test.js
  categories.test.js
  import-export.test.js
  transactions.test.js
  ui.test.js
  storage.test.js
  events.test.js
  integration.test.js
```

## Project Structure

```
js/
  main.js             # app initialization
  dom.js              # DOM element references
  utils.js            # date parsing, CSV line parsing, BRL-to-CAD conversion
  categories.js       # category definitions, auto-categorization, dropdowns
  storage.js          # LocalStorage load/save
  transactions.js     # transaction CRUD, filtering, deduplication
  ui.js               # rendering, sorting, summary updates
  import-export.js    # CSV parsing (6 formats), export
  events.js           # event listener wiring
index.html
styles.css
```
