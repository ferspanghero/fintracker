# FinTracker v2 - Task List

## Preliminary
- [x] Commit uncommitted `categories.js` changes (new keywords: rogers, caffe mira, brewing, ice cream, soccavo, shoes)

## Phase 1: Test Infrastructure & Coverage (target: 90%+)

### Setup
- [x] 1.1 Create `package.json` with vitest, @vitest/coverage-v8, jsdom dev dependencies
- [x] 1.2 Create `vitest.config.js` with jsdom environment, coverage thresholds
- [x] 1.3 Update `.gitignore` to include `node_modules/` and `coverage/`
- [x] 1.4 Create `tests/helpers/dom-fixture.js` -- extract minimal HTML from `index.html`
- [x] 1.5 Create `tests/helpers/setup.js` -- vm.runInThisContext file loading, DOM injection, state reset

### Test Files
- [x] 1.6 Write `tests/utils.test.js`
- [x] 1.7 Write `tests/categories.test.js`
- [x] 1.8 Write `tests/import-export.test.js`
- [x] 1.9 Write `tests/transactions.test.js`
- [x] 1.10 Write `tests/ui.test.js`
- [x] 1.11 Write `tests/storage.test.js`
- [x] 1.12 Write `tests/events.test.js`
- [x] 1.13 Write `tests/integration.test.js`
- [x] 1.14 Run `npm run test:coverage`, iterate until 90%+ coverage achieved
- [x] 1.15 Commit Phase 1

## Phase 2: ES Module Conversion

### Shared State
- [x] 2.1 Create `js/state.js` with exported `transactions`, `currentSort`, `currentFilter`

### Source File Conversion
- [x] 2.2 Convert `js/utils.js` to ES module (add exports)
- [x] 2.3 Convert `js/dom.js` to ES module (export refs as `let`, add `refreshDom()`)
- [x] 2.4 Convert `js/categories.js` to ES module (add imports/exports)
- [x] 2.5 Convert `js/storage.js` to ES module (add imports/exports, reassignments→mutations)
- [x] 2.6 Convert `js/transactions.js` to ES module (add imports/exports, reassignments→mutations)
- [x] 2.7 Convert `js/ui.js` to ES module (add imports/exports, onclick→addEventListener)
- [x] 2.8 Convert `js/import-export.js` to ES module (add imports/exports)
- [x] 2.9 Convert `js/events.js` to ES module (add imports/exports)
- [x] 2.10 Convert `js/main.js` to ES module (add imports, remove state vars)

### HTML & Tests
- [x] 2.11 Update `index.html` -- replace 9 `<script>` tags with single `<script type="module">`
- [x] 2.12 Rewrite `tests/helpers/setup.js` -- replace vm.runInThisContext with ES imports
- [x] 2.13 Update all 8 test files -- replace `globalThis.*` with ES module imports
- [x] 2.14 Run `npm test`, verify all 225 tests pass
- [x] 2.15 Commit Phase 2

## Phase 3: Bug Fixes

- [x] 3.1 Fix TDZ crash: reorder declarations in `parseFinTrackerTransaction` (`import-export.js:183-188`), fix comment on line 179
- [x] 3.2 Fix missing `totalDuplicates` arg in `reader.onerror` (`import-export.js:93`)
- [x] 3.3 Fix silent date corruption: return `null` from `parseDate` for invalid dates (`utils.js:60-64`), add null guards in all 6 parsers
- [x] 3.4 Fix redundant toLowerCase in `categorizeTransaction` (`categories.js:192`)
- [x] 3.5 Fix CSV parser escaped quote handling (`utils.js:84-85`), remove explicit `""` replacement in `parseFinTrackerTransaction` (line 184)
- [x] 3.6 Update TODO bug tests to assert correct behavior
- [x] 3.7 Run `npm test`, verify all pass (238 tests, 0 failures)
- [x] 3.8 Commit Phase 3

## Phase 4: Security

- [x] 4.1 Add `escapeHTML()` function to `js/utils.js`
- [x] 4.2 Wrap all user-controlled values in `renderTransactions` innerHTML template (`ui.js:26-41`)
- [x] 4.3 Add tests for escapeHTML and XSS prevention
- [x] 4.4 Run `npm test`, verify all pass (248 tests, 0 failures)
- [x] 4.5 Commit Phase 4

## Phase 5: Reliability

- [x] 5.1 Fix O(n^2) rendering: build index Map, replace indexOf calls (`ui.js:13-55`)
- [x] 5.2 Add null crash protection in text filter (`transactions.js:157-159`)
- [x] 5.3 Add `totalErrors` counter and surface import errors to user (`import-export.js`)
- [x] 5.4 Remove `saveToMonthlyFiles` function and call (`storage.js`), add localStorage cleanup
- [x] 5.5 Extract `BRL_TO_CAD_RATE` constant with documentation (`utils.js:98-99`)
- [x] 5.6 Update tests for removed/changed behavior
- [x] 5.7 Run `npm test`, verify all pass (250 tests, 0 failures)
- [x] 5.8 Commit Phase 5

## Phase 6: Code Quality

- [x] 6.1 Extract `saveAndRefresh()` helper, replace 6 occurrences (`transactions.js`, `import-export.js`)
- [x] 6.2 Change `map()` to `forEach()` for side effects (`transactions.js:99`)
- [x] 6.3 Remove duplicate CSS `text-align: left` (`styles.css:155`)
- [x] 6.4 Move `getTransactionKey` from `transactions.js` to `import-export.js`
- [x] 6.5 Run `npm test`, verify all pass (251 tests, 0 failures)
- [x] 6.6 Commit Phase 6
