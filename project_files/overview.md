# Technical Overview

FinTracker is a single-page personal finance app. Vanilla JS with ES modules loaded directly by the browser — no transpilation, no bundler. A static file server (e.g. `npx serve .`) is needed to serve the files (browsers block ES module imports from `file://`), but there is no build or compilation step. All data lives in localStorage.

## Architecture

The app follows a layered architecture with unidirectional data flow:

```
User Action (click, import, filter)
    │
    ▼
Event Handlers (events.js)
    │
    ▼
Business Logic (transactions.js, import-export.js)
    │
    ▼
State Mutation (state.js)
    │
    ▼
Persist + Re-render (storage.js → ui.js)
```

### Layer Breakdown

**State** (`state.js`) — mutable exports shared across the app, always updated in place (importers hold the references):
- `transactions[]` — all transaction objects
- `settings` — `{ version, rates, categories, assets, holdings, targets, fire }` (see Data Model)
- `balances` — month-end asset balances
- `closedMonths[]` — Balance Sheet months marked closed
- `registeredRoom[]` — RRSP / TFSA room and contributions per year and person
- `currentSort` — `{ field, direction }`
- `currentFilter` — `{ dateRange, startDate, endDate, category, textFilter }`
- `replaceAll(data)` — swaps in all the data collections (load and Restore)

**Pure logic** (no DOM dependencies):
- `category-engine.js` — keyword-based auto-categorization. Exposes `loadCategoryKeywords(path?)`, which merges generic keywords with optional personal overrides loaded from a gitignored file, and `categorizeTransaction(description, type, keywords)`, which scans a pre-built map. Holds no module-level state — callers (the UI layer and the benchmark tool) pass the path they want and hold the resulting map.
- `ignore-rules.js` — import ignore list for transfers between your own accounts. Exposes `loadIgnorePrefixes(path?)`, which merges an optional `ignorePrefixes` export from the same gitignored personal file with generic bank-wording prefixes (trimmed, lowercased, blanks dropped), and `isIgnored(description, prefixes)`, a case-insensitive starts-with match on the whole description.
- `utils.js` — CSV line tokenizer (handles quoting), currency conversion, local month/date keys, number/money/percent formatting, HTML escaping, reading a file as text.
- `constants.js` — literals shared across modules: transaction types and the base currency.
- `settings.js` — rules for the settings object: add/remove categories (only unused ones, `Sem Categoria` is permanent), `ensureCategory` for write paths that bring categories from outside the app, add/rename/archive assets and set their details (type, institution, owner, holding — a typed asset's name is generated from them), set rates, holdings' asset-class splits, the target allocation and the FIRE inputs. `migrateSettings` brings saved settings of any version to the current shape. Every mutator returns `{ ok }` or `{ ok: false, error }` with a user-facing message and changes nothing on failure.
- `balance-sheet.js` — `buildYear(...)` derives one year of the Balance Sheet (month states, asset rows, net worth, income/expense rows with closed-month averages and the previous-year comparison, indicators) from data passed in, including `today`. Also the balance, Copy-previous and close/reopen helpers.
- `fire.js` — `buildFire(...)` derives the Investments & FIRE tab from data passed in, including `today`: FI portfolio (every asset minus its holding's cash share), FI number (spending ÷ (1 − withdrawal tax) ÷ SWR), progress and freedom days, the yearly projection (actual years are closed Decembers; open and projected years use the expected return minus inflation and a tax drag on the non-registered share), allocation against target, and holdings.
- `registered-room.js` — RRSP / TFSA room rows per year (people come from the owners of registered assets), what is left, over-contribution warnings, and the value parser and validator.
- `explanations.js` — the plain-language texts behind the hover balloons and `tip()`, which marks a term up as a focusable span described by its `role="tooltip"` balloon; `initTips()` wires Escape to hide balloons.
- `backup.js` — backup envelope and `validateBackup`, which collects every problem before anything is applied and rebuilds the data from known fields only. Older backup versions still restore and are migrated.
- `rates.js` — fetches and parses the latest Bank of Canada USD → CAD and BRL → CAD rates (injectable `fetch`, timeout).
- `parsers/` — one module per bank format, each owning its own line splitting, date parsing, and field extraction. Connected via a registry (`parsers/index.js`).

**DOM layer**:
- `dom.js` — cached element references, with `refreshDom()` for test injection.
- `ui.js` — renders transaction table, summary totals, sort icons.
- `categories.js` — wraps `category-engine.js` with dropdown rendering. Both the dropdowns and the categorizer read `settings.categories`; the keyword map is narrowed to those categories on every call.
- `tabs.js` — tab bar; one panel visible at a time.
- `modal.js` — shared dialog behaviour: open/close, focus moved in and returned, the page behind made inert, closing with ×, the backdrop or Escape (each close fires `modal-close`).
- `balance-sheet-ui.js` — Balance Sheet tab: year selector, grid, inline balance editing (mouse or keyboard), close/reopen, Copy prev., indicators.
- `fire-ui.js` — Investments & FIRE tab: stats, progress, projection, allocation, holdings, the editable registered-room table (with its own year selector), assumptions.
- `settings-ui.js` — Settings tab: rates and refresh, category chips, assets table with details, asset-class splits and targets, FIRE assumptions, Backup download and Restore.

**Orchestration**:
- `import-export.js` — CSV import pipeline (files read one at a time → parser registry → auto-categorization → ignore list → duplicate detection → state push) and CSV export.
- `transactions.js` — CRUD, filtering, and `saveAndRefresh()` helper that persists to localStorage then re-renders.
- `events.js` — wires all DOM event listeners.
- `main.js` — bootstrap: sets defaults, loads localStorage, populates dropdowns, attaches listeners, wires the tabs. The Balance Sheet, Investments & FIRE and Settings tabs re-render when they open.

**Persistence** (`storage.js`) — the only localStorage reader/writer. Keys: `transactions`, `settings`, `balances`, `closedMonths`, `registeredRoom`. Settings pass through `migrateSettings` as they load. Dates are stored as ISO strings and rehydrated to `Date` objects on load. Missing keys load as a fresh install; loading never writes. `saveData()` writes every key; `saveBalanceSheet()` writes only `balances` and `closedMonths`, which is all the Balance Sheet grid changes; `saveRegisteredRoom()` writes only `registeredRoom`. All report whether the save succeeded.

## Data Model

```js
// settings
{
  version: 2,
  rates: { USD: number | null, BRL: number | null, date: 'YYYY-MM-DD' | null, refreshedAt: ISO | null },
  categories: { expense: string[], income: string[] },   // each always contains 'Sem Categoria'
  assets: [{ id, name, currency: 'CAD' | 'USD' | 'BRL', archived: boolean,
             type: string | null, institution: string, owner: string, holding: string }],   // type from ASSET_TYPES
  holdings: [{ name, split: { [assetClass]: percent } }],   // shares add up to 100; matched to assets by holding, ignoring case
  targets: { [assetClass]: percent } | {},   // a class left out has no target; 0 means none of it
  fire: { swr, withdrawalTax, retirementSpending, expectedReturn, inflation,
          nonRegTaxDrag, birthYear, projectionStart, projectionEnd }   // percentages as numbers (4 = 4%)
          // null means "worked out from your data": spending = last 12 months; years = first year with balances → +20 years
}
// balances — native amounts in each asset's currency; an absent key is a blank cell
{ 'YYYY-MM': { [assetId]: number } }
// closedMonths
['YYYY-MM', ...]
// registeredRoom — CAD; one entry per year, account and person
[{ year, account: 'RRSP' | 'TFSA', person, room: number | null, contributed: number | null }]
```

Holdings and room entries are lists, so names typed by the user never become object keys.

A fresh install has only `Sem Categoria` in each category list, no assets, and no rates. Transaction categories always come from the Settings list: an imported row that is kept (not ignored, not a duplicate) adds its category if the list lacks it, and manual entries default to `Sem Categoria`. A backup is the data collections wrapped in `{ app: 'fintracker', version: 2, exportedAt, ... }`; a version 1 backup restores with its settings migrated and no registered room.

## CSV Import Pipeline

```
File Input → readFileText (one file at a time) → parseCSV(content, fileType, ctx = { rates })
                              │
                              ├─ fileType === 'auto' → detectParser(headerRow)
                              │                          iterates parsers until detect() matches
                              │
                              └─ fileType explicit  → getParserById(id)
                              │
                              ▼
                         parser.validateContext(ctx) if defined (Bradesco: needs a BRL rate; the file fails up front)
                              │
                              ▼
                         For each line:
                           parser.parseLine(line, ctx) → { date, description, amount, type, account }
                           orchestrator adds a category via categorizeTransaction() when the parser set none
                              │
                              ▼
                         Ignore list (description starts with an ignore prefix → skipped, counted)
                              │
                              ▼
                         Duplicate detection (composite key: date-description-amount-type-account)
                              │
                              ▼
                         ensureCategory (adds the row's category to Settings if missing) → push to transactions[]
                              │
                              ▼
                         saveAndRefresh() → result dialog with per-month counts
```

### Parser Contract

Each parser in `js/parsers/` exports a plain object:

```js
{
    id: 'amex',
    name: 'American Express',
    account: 'Amex',
    hasHeader: true,
    detect(headerRow) {},    // returns boolean; headerRow arrives lowercased, trimmed, quotes stripped
    parseDate(dateStr) {},   // returns Date or null
    validateContext?(ctx) {},// optional; returns an error message to refuse the whole file, or null
    parseLine(line, ctx) {}  // returns transaction object or null; ctx = { rates }
}
```

`parseLine` may set `category` (a FinTracker export carries one); otherwise the orchestrator categorizes the row. It returns `amount` as a positive number and derives `type` from the amount's sign or the file's debit/credit columns — never from a bank's transaction-type label, which misses refunds and other credits.

Adding a new bank format: create a parser file, add one import to `parsers/index.js`.

## Auto-Categorization

`categorizeTransaction(description, type, categoryKeywords)` in `category-engine.js`:
1. Normalizes description to lowercase
2. Checks each keyword in `categoryKeywords[type]` for substring match
3. Returns the first matching category, or the `UNCATEGORIZED` fallback if none match (the app passes a map narrowed to the Settings categories, so absent categories are skipped)
4. Income fallback: if an income description matches no income keyword but matches an expense keyword, it's routed to the refund category

The keyword map itself is produced by `loadCategoryKeywords(path?)`, which merges the generic keywords shipped with the engine with optional personal overrides dynamically imported from `path`. Missing/unreadable files are swallowed so fresh clones work with zero config. Personal entries are prepended per category so they win under first-match-wins. `categories.js` calls the loader once at module load with a constant pointing to a gitignored file; the benchmark tool does the same with the same path. A committed example template can be copied to the gitignored name to add local merchants, banks, or other entries you'd rather not publish.

## Transaction Object Shape

```js
{
    date: Date,
    description: string,
    amount: number,        // always positive
    type: 'income' | 'expense',
    category: string,
    account: string        // e.g. 'Amex', 'TD', 'Bradesco'
}
```

## Testing

Vitest with jsdom. Tests mirror the source structure:

- `tests/parsers/` — one file per parser + registry + date helpers
- `tests/*.test.js` — one file per source module
- `tests/helpers/` — DOM fixture (read from `index.html`) and state reset between tests; tests start with a sample category list from `tests/fixtures/`

Playwright drives the real page in Chromium (`npm run test:e2e`). Specs live in `tests/e2e/`, seed LocalStorage with synthetic data, fix the clock, and mock the Bank of Canada; a dependency-free static server serves only the app's files. The scenarios are listed in the latest `project_files/v*/plan.md`.
