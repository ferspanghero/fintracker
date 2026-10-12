# FinTracker Production Quality Remediation Plan

## Context

FinTracker is a vanilla JS personal finance tracker (~1500 LOC, 9 JS files, 1 HTML, 1 CSS) with zero dependencies and zero test coverage. A thorough code review found 5 bugs, 2 security vulnerabilities, 5 reliability issues, and 6 code quality problems.

**Strategy**: Tests first. The app works today, so we build a safety net capturing current behavior (including known bugs), then fix and refactor with confidence.

**Preliminary step**: Commit the existing uncommitted `categories.js` change (new keywords) separately.

---

## Phase 1: Test Infrastructure & 90%+ Coverage

### 1A. Setup

**New files**: `package.json`, `vitest.config.js`, `.gitignore` update

Install vitest, @vitest/coverage-v8, jsdom as dev dependencies. Configure vitest with jsdom environment, global test APIs, setup file, and coverage thresholds (90% lines/functions/statements, 85% branches).

### 1B. Test helpers

**`tests/helpers/dom-fixture.js`**: Minimal HTML extracted from `index.html` -- all element IDs and structure needed for `dom.js` to load and DOM-dependent tests to work.

**`tests/helpers/setup.js`**:
- Inject DOM fixture into jsdom document
- Use `vm.runInThisContext()` to load source files in dependency order (matching script tag order), converting `const`/`let` to `var` so declarations land in global scope (mimics how `<script>` tags share a global lexical environment)
- No source file changes needed -- tests access globals directly via `globalThis`
- `beforeEach`: reset DOM fixture, re-cache DOM references, reset `transactions`, `currentSort`, `currentFilter`, `categories` to defaults, `localStorage.clear()`

### 1C. Test files

```
tests/
  helpers/
    setup.js
    dom-fixture.js
  utils.test.js
  categories.test.js
  import-export.test.js
  transactions.test.js
  ui.test.js
  storage.test.js
  events.test.js
  integration.test.js
```

### 1D. Coverage strategy

Pure function tests alone = ~51% coverage. We need jsdom tests for DOM-dependent code to reach 90%+.

| File | Lines | Key functions to test |
|------|-------|----------------------|
| `utils.js` | 100 | parseDate (6 formats + invalid), parseCSVLine (quotes, escapes), BRLtoCAD, dateStrInputToLocalDate |
| `categories.js` | 277 | categorizeTransaction, populateCategoryDropdowns, populateTransactionCategorySelect, handleCategorySelectChange, handleCategoryFilterChange + static data validation |
| `import-export.js` | 455 | All 6 parse*Transaction functions, detectFileType, parseCSV, convertTransactionsToCSV, handleImport/processFiles (with FileReader mock) |
| `transactions.js` | 224 | getTransactionKey, getFilteredTransactions (date/category/text filters), handleAddTransaction, updateTransactionField, deleteTransaction, deleteSelectedTransactions, confirmClearAll |
| `ui.js` | 222 | sortTransactions (date/amount/category/string), renderTransactions, updateSummary, handleDateRangeChange, applyCustomDateFilter, handleSort, updateSortIcons |
| `storage.js` | 55 | loadData, saveData, saveToMonthlyFiles |
| `events.js` | 68 | addEventListeners (verify all event wiring via spies + simulated events) |
| `dom.js` | 36 | Loading with HTML fixture covers it |
| `main.js` | 30 | init() with pre-populated localStorage |

### 1E. Known bugs documented as tests

Each bug captured with current (buggy) behavior and `// TODO: BUG` comment:

1. **`parseDate` returns `new Date()` for invalid dates** (`utils.js:60-63`)
2. **`parseFinTrackerTransaction` TDZ crash** (`import-export.js:185`) -- ReferenceError when `parts[2]` empty
3. **`processFiles` onerror missing `totalDuplicates`** (`import-export.js:93`)
4. **`categorizeTransaction` redundant `toLowerCase`** (`categories.js:187,192`)
5. **`parseCSVLine` drops escaped quotes** (`utils.js:84-85`)
6. **`detectFileType` doesn't strip BOM** (`import-export.js:159`)

### 1F. Integration tests

- Import Amex CSV -> verify transactions populated
- Export -> re-import round-trip
- Duplicate detection across files
- Filter after import
- Full init cycle with pre-populated localStorage

---

## Phase 2: ES Module Conversion

Replace the `vm.runInThisContext()` test harness with standard ES module `import`/`export`. This eliminates the const→var string manipulation hack and lets tests import source files directly.

### 2A. Shared mutable state

Create `js/state.js` (new file, zero imports) to hold shared mutable state that is reassigned across module boundaries:
```js
export const transactions = [];
export const currentSort = { field: 'date', direction: 'desc' };
export const currentFilter = { dateRange: 'all', startDate: null, endDate: null, category: 'all', textFilter: '' };
```

ES module imports are read-only bindings, so all cross-module reassignments must become mutations:
- `transactions = []` → `transactions.length = 0`
- `transactions = JSON.parse(...)` → `transactions.length = 0; parsed.forEach(t => transactions.push(t))`
- `categories = JSON.parse(...)` → `Object.assign(categories, parsed)`

### 2B. Convert source files to ES modules

Add `import`/`export` statements to all 9 JS files. Convert in dependency order:
1. `js/utils.js` — export functions, no imports needed
2. `js/dom.js` — export element references as `let`, add `refreshDom()` function for tests to re-cache after DOM reset
3. `js/categories.js` — import from dom.js, state.js; export categories data and functions
4. `js/storage.js` — import from state.js, categories.js; convert reassignments to mutations
5. `js/transactions.js` — import from state.js, dom.js, utils.js, categories.js, storage.js, ui.js
6. `js/ui.js` — import from state.js, dom.js, utils.js, transactions.js, categories.js
7. `js/import-export.js` — import from state.js, dom.js, utils.js, categories.js, transactions.js, storage.js, ui.js
8. `js/events.js` — import from all modules it wires up
9. `js/main.js` — import and call init dependencies

### 2C. Replace inline onclick with addEventListener

**File**: `js/ui.js:44` — The inline `onclick="deleteTransaction(...)"` calls a global function. ES modules are module-scoped, so this must become `addEventListener` on the button element after creation.

### 2D. Update `index.html`

Replace all 9 `<script>` tags with a single module entry point:
```html
<script type="module" src="js/main.js"></script>
```

**Note**: ES modules require HTTP(S) — `file://` protocol won't work. Use `npx serve .` or similar local server.

### 2E. Rewrite test helpers

**`tests/helpers/setup.js`**: Replace `vm.runInThisContext()` with standard ES imports:
- Import `refreshDom` from `dom.js`
- Import shared state from `state.js` and `categories.js`
- `beforeEach`: reset DOM fixture, call `refreshDom()`, reset state via mutations, `localStorage.clear()`

### 2F. Update test files

Replace all `globalThis.*` references with proper ES module imports. Each test file imports exactly what it tests plus shared state for setup.

---

## Phase 3: Bug Fixes

Update TODO tests to assert correct behavior as each bug is fixed.

### 3A. TDZ crash in `parseFinTrackerTransaction`
**File**: `js/import-export.js:183-188` -- Reorder declarations so `type` is before `category`. Fix comment on line 179.

### 3B. Missing `totalDuplicates` in `reader.onerror`
**File**: `js/import-export.js:93` -- Add 4th argument.

### 3C. Silent date corruption
**File**: `js/utils.js:60-64` -- Return `null` instead of `new Date()`. Add null guard after every `parseDate()` call in all 6 parsers.

### 3D. Redundant `toLowerCase`
**File**: `js/categories.js:192` -- Change to `if (description.includes(keyword))`.

### 3E. CSV parser escaped quote handling
**File**: `js/utils.js:84-85` -- Detect consecutive `""` inside quoted fields, emit single `"`. Remove explicit `""` replacement in `parseFinTrackerTransaction` (line 184).

---

## Phase 4: Security (XSS Prevention)

### 4A. HTML injection via innerHTML
**Files**: `js/utils.js` (new `escapeHTML`), `js/ui.js:26-41` -- Add escapeHTML utility, wrap all user-controlled values in renderTransactions template.

---

## Phase 5: Reliability Improvements

### 5A. O(n^2) rendering fix
**File**: `js/ui.js:13-55` -- Build `Map(transactions.map((t,i) => [t,i]))`, use O(1) lookups.

### 5B. Null crash protection in text filter
**File**: `js/transactions.js:157-159` -- Use `(field || '').toLowerCase()`.

### 5C. Show import errors to user
**File**: `js/import-export.js` -- Add `totalErrors` counter, surface in final alert.

### 5D. Remove `saveToMonthlyFiles` waste
**File**: `js/storage.js` -- Remove function and call. Cleanup stale localStorage keys.

### 5E. Document hardcoded exchange rate
**File**: `js/utils.js:98-99` -- Extract to named constant `BRL_TO_CAD_RATE`.

---

## Phase 6: Code Quality

### 6A. Extract `commitAndRefresh()` helper
**Files**: `js/transactions.js`, `js/import-export.js` -- Replace 6+ repeated triples.

### 6B. `map()` -> `forEach()` for side effects
**File**: `js/transactions.js:88`

### 6C. Remove duplicate CSS `text-align`
**File**: `styles.css:155`

### 6D. Move `getTransactionKey` to `import-export.js`
**Files**: `js/transactions.js:221-223` -> `js/import-export.js`

---

## Deferred

Deferred work is tracked in [`project_files/backlog.md`](../backlog.md).

---

## Critical Files Reference

| File | Phase 1 (Tests) | Phase 2 (ES Modules) | Phases 3-6 (Fixes) |
|------|-----------------|---------------------|---------------------|
| `js/state.js` | -- | NEW: shared mutable state | -- |
| `js/import-export.js` | 6 parser tests, detectFileType, parseCSV, convertTransactionsToCSV, round-trip | Add imports/exports | TDZ fix, missing arg, error reporting, commitAndRefresh, move getTransactionKey in |
| `js/ui.js` | sort, render, summary, filter, sort icon tests | Add imports/exports, onclick→addEventListener | XSS escaping, indexOf optimization |
| `js/utils.js` | parseDate, parseCSVLine, BRLtoCAD, dateStrInputToLocalDate tests | Add exports | Date null return, escapeHTML, CSV quote fix, BRL constant |
| `js/transactions.js` | getFilteredTransactions, getTransactionKey, CRUD tests | Add imports/exports, reassignment→mutation | Null protection, commitAndRefresh, map->forEach |
| `js/categories.js` | categorizeTransaction, dropdown tests | Add imports/exports | Remove redundant toLowerCase |
| `js/storage.js` | load/save/monthly tests | Add imports/exports, reassignment→mutation | Remove saveToMonthlyFiles |
| `js/dom.js` | Loading with HTML fixture | Add exports, refreshDom() | -- |
| `js/events.js` | Event wiring spy tests | Add imports/exports | -- |
| `js/main.js` | init() test | Add imports, remove state vars | -- |
| `index.html` | Source for DOM fixture | Single `<script type="module">` | -- |
| `styles.css` | -- | -- | Remove duplicate text-align |
