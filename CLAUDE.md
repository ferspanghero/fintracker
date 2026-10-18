# FinTracker

Browser-only personal finance tracker: imports bank CSVs, auto-categorizes transactions, persists to LocalStorage. Vanilla ES modules, no build step, no runtime dependencies.

Read `README.md` for setup, usage, and supported banks, `project_files/overview.md` for the architecture, the latest `project_files/v*/plan.md` for test scenarios, and `project_files/backlog.md` for deferred work — don't duplicate those here.

## Commands

```bash
npx serve . -l 3000                                        # run the app (http://localhost:3000)
npm test                                                   # run tests once
npm run test:watch                                         # watch mode
npm run test:coverage                                      # coverage report
npm run test:e2e                                           # Playwright end-to-end specs (Chromium)
node tools/category-benchmark/run-category-benchmark.mjs   # categorizer match rate vs ground truth
```

No linter or build step is configured — don't invent one.

## Key files

```
js/category-engine.js   # pure categorization: keyword map + matcher, no DOM deps
js/personal-keywords.js # gitignored local overrides (template: personal-keywords.example.js)
js/categories.js        # loads the merged keyword map, wraps the categorizer, drives dropdowns
js/ignore-rules.js      # import ignore list: generic prefixes, personal-file loader, matcher
js/settings.js          # pure rules for rates, the category list, assets, class splits, FIRE inputs; migrateSettings
js/balance-sheet.js     # pure Balance Sheet model (buildYear + balance helpers)
js/fire.js              # pure Investments & FIRE model (buildFire: FI stats, projection, allocation)
js/registered-room.js   # pure RRSP / TFSA room rules
js/explanations.js      # hover-explanation texts + tip() markup
js/backup.js            # pure backup format + validateBackup
js/constants.js         # shared literals (transaction types, base currency) — use these, not string literals
js/modal.js             # every dialog opens and closes through openModal / closeModal
js/*-ui.js              # tab rendering/wiring for Balance Sheet, Investments & FIRE, and Settings
js/parsers/             # one module per bank format + a registry
tests/                  # mirrors js/; fixtures/ holds injectable module fixtures
tests/e2e/              # Playwright specs, shared helpers, static test server
tools/category-benchmark/
```

## Conventions & gotchas

- **Tests are the gate.** Vitest + jsdom, coverage thresholds in `vitest.config.js` (statements/lines/functions 90, branches 85). Cover both branches by **injecting fixtures**, never by renaming or deleting real files.
- **`js/categories.js` and `js/import-export.js` use top-level `await`** (personal keywords, ignore prefixes), so module evaluation can finish after `DOMContentLoaded`. `js/main.js` handles that with a `document.readyState` register-or-run branch — keep them in sync if any changes.
- **Nothing personal gets committed.** `js/personal-keywords.js` and `resources/` are gitignored. Local merchant names, banks, and raw statement data stay out of tracked files — including tests, which use sentinel strings instead.
- **Auto-detect sees only the file's first line**, lowercased, trimmed, and with double quotes stripped — write `detect()` against that bare text. If a bank export opens with a title or preamble row, the parser's `detect()` must recognize that row, or the file silently falls through to the TD fallback. `hasHeader` skips only line 0, so `parseLine` must return `null` for any further header or metadata rows.
- **Income vs expense comes from the amount's sign or debit/credit columns, never a bank's type label** — labels miss refunds and other credits (see the parser contract in `project_files/overview.md`).
- A fresh clone works with zero config: a missing personal-keywords file falls back to generic keywords only.
- **State is mutated in place.** `state.js` exports are shared references; update them (or call `replaceAll`) — never reassign. `storage.js` is the only LocalStorage reader/writer; loading never writes.
- **Keep pure modules pure.** `settings.js`, `balance-sheet.js`, `fire.js`, `registered-room.js`, `backup.js`, `rates.js`, `category-engine.js` take data (and `today`/`now`/`fetch`) as arguments; DOM work lives in the UI modules.
- **Every stored transaction category must exist in `settings.categories` for its type** — otherwise the app's own Backup fails `validateBackup`. Any new write path must add the category through `settings.js` (`ensureCategory`) or fall back to `Sem Categoria`; imports do this only for rows they keep.
- **Settings and backups are versioned.** A change to the stored shape bumps `SETTINGS_VERSION` / `BACKUP_VERSION`, extends `migrateSettings` (loading and old backups go through it), and adds the new fields to `backup.js`'s rebuild — Restore keeps only fields it knows, so a field missing there is silently dropped. Keep the buildBackup → JSON → validateBackup round-trip test passing.
- **User-typed names never become object keys.** Holding splits and registered room are stored as lists of `{ name | person, … }`; look entries up ignoring case.
- **Edits that keep focus update in place.** Room inputs, asset details, class splits and FIRE inputs save and patch their own row or field instead of re-rendering, so Tab lands where the user expects — keep it that way when adding fields.
- **Worked-out defaults look like open months.** A setting left blank that falls back to a value from the user's data (retirement spending, projection years) shows that value as a grey italic placeholder (`input.has-default`) and states it in its hover explanation (`tip(..., { extra })`); the tab shows such values with `dd.default`. Follow the same pattern for any new default.
- **Dialogs go through `js/modal.js`**, never `style.display`: it moves focus in and back, makes the page inert, keeps stacked dialogs in order, and fires `modal-close` so owners can drop pending state.
- **The Balance Sheet grid re-renders on every save**, replacing the rows whose markup changed. Code that acts after a save must look elements up again by their data attributes (see `cellFor` / `relocator` in `balance-sheet-ui.js`), not hold references. Grid saves use `saveBalanceSheet()`, which skips transactions and settings — a grid action that changes those must call `saveData()`. Moving the selection and ending an edit unchanged must not save or re-render — that keeps navigation instant.
- **Month keys use local time** (`monthKey`, `dateInputValue` in `utils.js`), never `toISOString()`. Exception: `getTransactionKey` keeps its UTC date — changing it breaks duplicate detection against stored data.
- **Parsers receive a context:** `parseLine(line, { rates })`; a parser that can't work without it implements `validateContext` to refuse the whole file.
- **Unit tests start with a sample category list** (`tests/fixtures/sample-categories.js`), and the DOM fixture is read from `index.html` — new element ids only need adding to `index.html` and `dom.js`.
- **E2E specs use synthetic data only**, a fixed clock, and a mocked Bank of Canada (`tests/e2e/helpers.js`; `makeSettings` returns current-format settings). The test server serves only `index.html`, `styles.css`, and `js/` (never personal keywords). `@playwright/test` is pinned to the version matching the locally cached browsers — don't bump it without checking the browser builds.

## Categorization rules

The matcher is **case-insensitive substring, first match wins**, scanning categories in the order they are declared in `genericKeywords`, then keywords within each category.

- **Category declaration order decides cross-category ties.** A keyword in an earlier category beats one in a later category regardless of specificity — an over-broad word high in the list silently claims descriptions meant for a category below it. Prefer the narrowest keyword that still matches (`holiday inn`, not `holiday`).
- **Personal keywords are prepended per category**, so they win *within* a category — but they cannot outrank an earlier category. Placing a merchant in the right category matters more than adding the keyword.
- **Where a keyword belongs:** concepts and well-known brands → `js/category-engine.js`; local merchants, banks, and anything identifying → the gitignored personal file.
- **Income falls back to `Reembolso`** when a description matches no income keyword but does match an expense keyword — a refund of a purchase, not new income. Don't add merchant names to `income.Trabalho` to force a route; that turns every refund from that merchant into salary.
- Category names are Brazilian Portuguese (user data); all UI text is English. The user's category list lives in `settings.categories`; the keyword map is a catalog, narrowed to that list at call time, so a route to a category the user doesn't have falls through to the next match.

## Ignore list rules

Imported rows whose description, trimmed and lowercased, **starts with** an ignore prefix are skipped and counted (before the duplicate check). Meant for money moving between the user's own accounts — card payments, savings transfers — which otherwise land twice.

- **Use complete phrases, never bare words.** A starts-with match on `payment` would drop legitimate rows.
- **Where a prefix belongs:** standard bank wording → `genericIgnorePrefixes` in `js/ignore-rules.js`; anything naming the user's bank, issuer, or accounts → the personal file's `ignorePrefixes` export.
- Match against the description **as parsed** (e.g. the Mastercard parser appends ` (CARDHOLDER)`), which a prefix naturally tolerates.
