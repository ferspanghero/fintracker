# FinTracker

Browser-only personal finance tracker: imports bank CSVs, auto-categorizes transactions, persists to LocalStorage. Vanilla ES modules, no build step, no runtime dependencies.

Read `README.md` for setup, usage, and supported banks, and `project_files/overview.md` for the architecture and test scenarios — don't duplicate those here.

## Commands

```bash
npx serve . -l 3000                                        # run the app (http://localhost:3000)
npm test                                                   # run tests once
npm run test:watch                                         # watch mode
npm run test:coverage                                      # coverage report
node tools/category-benchmark/run-category-benchmark.mjs   # categorizer match rate vs ground truth
```

No linter or build step is configured — don't invent one.

## Key files

```
js/category-engine.js   # pure categorization: keyword map + matcher, no DOM deps
js/personal-keywords.js # gitignored local overrides (template: personal-keywords.example.js)
js/categories.js        # loads the merged keyword map, wraps the categorizer, drives dropdowns
js/parsers/             # one module per bank format + a registry
tests/                  # mirrors js/; fixtures/ holds injectable module fixtures
tools/category-benchmark/
```

## Conventions & gotchas

- **Tests are the gate.** Vitest + jsdom, coverage thresholds in `vitest.config.js` (statements/lines/functions 90, branches 85). Cover both branches by **injecting fixtures**, never by renaming or deleting real files.
- **`js/categories.js` uses top-level `await`**, so its module evaluation can finish after `DOMContentLoaded`. `js/main.js` handles that with a `document.readyState` register-or-run branch — keep the two in sync if either changes.
- **Nothing personal gets committed.** `js/personal-keywords.js` and `resources/` are gitignored. Local merchant names, banks, and raw statement data stay out of tracked files — including tests, which use sentinel strings instead.
- A fresh clone works with zero config: a missing personal-keywords file falls back to generic keywords only.

## Categorization rules

The matcher is **case-insensitive substring, first match wins**, scanning categories in the order they are declared in `genericKeywords`, then keywords within each category.

- **Category declaration order decides cross-category ties.** A keyword in an earlier category beats one in a later category regardless of specificity — an over-broad word high in the list silently claims descriptions meant for a category below it. Prefer the narrowest keyword that still matches (`holiday inn`, not `holiday`).
- **Personal keywords are prepended per category**, so they win *within* a category — but they cannot outrank an earlier category. Placing a merchant in the right category matters more than adding the keyword.
- **Where a keyword belongs:** concepts and well-known brands → `js/category-engine.js`; local merchants, banks, and anything identifying → the gitignored personal file.
- **Income falls back to `Reembolso`** when a description matches no income keyword but does match an expense keyword — a refund of a purchase, not new income. Don't add merchant names to `income.Trabalho` to force a route; that turns every refund from that merchant into salary.
- Categories are Brazilian Portuguese and defined in `defaultCategories`; the merged keyword map must only contain those keys.
