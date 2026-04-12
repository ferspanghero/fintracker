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

**State** (`state.js`) — Three mutable exports shared across the app:
- `transactions[]` — all transaction objects
- `currentSort` — `{ field, direction }`
- `currentFilter` — `{ dateRange, startDate, endDate, category, textFilter }`

**Pure logic** (no DOM dependencies):
- `category-engine.js` — keyword-based auto-categorization. Exposes `loadCategoryKeywords(path?)`, which merges generic keywords with optional personal overrides loaded from a gitignored file, and `categorizeTransaction(description, type, keywords)`, which scans a pre-built map. Holds no module-level state — callers (the UI layer and the benchmark tool) pass the path they want and hold the resulting map.
- `utils.js` — CSV line tokenizer (handles quoting), currency conversion, HTML escaping.
- `parsers/` — one module per bank format, each owning its own line splitting, date parsing, and field extraction. Connected via a registry (`parsers/index.js`).

**DOM layer**:
- `dom.js` — cached element references, with `refreshDom()` for test injection.
- `ui.js` — renders transaction table, summary totals, sort icons.
- `categories.js` — wraps `category-engine.js` with dropdown rendering. Holds mutable `categories` state (can grow when importing FinTracker exports with custom categories).

**Orchestration**:
- `import-export.js` — CSV import pipeline (file reading → parser registry → auto-categorization → duplicate detection → state push) and CSV export.
- `transactions.js` — CRUD, filtering, and `saveAndRefresh()` helper that persists to localStorage then re-renders.
- `events.js` — wires all DOM event listeners.
- `main.js` — bootstrap: sets defaults, loads localStorage, populates dropdowns, attaches listeners.

**Persistence** (`storage.js`) — serializes `transactions[]` and `categories` to localStorage. Dates are stored as ISO strings and rehydrated to `Date` objects on load.

## CSV Import Pipeline

```
File Input → FileReader → parseCSV(content, fileType)
                              │
                              ├─ fileType === 'auto' → detectParser(headerRow)
                              │                          iterates parsers until detect() matches
                              │
                              └─ fileType explicit  → getParserById(id)
                              │
                              ▼
                         For each line:
                           parser.parseLine(line) → { date, description, amount, type, account }
                           orchestrator adds category via categorizeTransaction()
                           parser.afterParse() if defined (FinTracker: registers custom categories)
                              │
                              ▼
                         Duplicate detection (composite key: date-description-amount-type-account)
                              │
                              ▼
                         Push to transactions[] → saveAndRefresh()
```

### Parser Contract

Each parser in `js/parsers/` exports a plain object:

```js
{
    id: 'amex',
    name: 'American Express',
    account: 'Amex',
    hasHeader: true,
    detect(headerRow) {},    // returns boolean
    parseDate(dateStr) {},   // returns Date or null
    parseLine(line) {},      // returns transaction object or null
    afterParse?(txn, ctx) {} // optional post-processing
}
```

Adding a new bank format: create a parser file, add one import to `parsers/index.js`.

## Auto-Categorization

`categorizeTransaction(description, type, categoryKeywords)` in `category-engine.js`:
1. Normalizes description to lowercase
2. Checks each keyword in `categoryKeywords[type]` for substring match
3. Returns the first matching category, or the `UNCATEGORIZED` fallback if none match
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
- `tests/helpers/` — DOM fixture and state reset between tests
