# Backlog

Work deliberately left out of a version, to be picked up by a future one. When an item is taken on, it moves into that version's `plan.md` and leaves this list.

## Features

- **Learned category map.** Remember the category of transactions already seen: a normalized `description → category` map (strip order ids and store numbers such as `AMAZON.CA*AB12CD34E` or `GROCER #1234`) that wins over the keyword engine, which stays the fallback for unseen merchants.
- **LLM categorizer.** A third layer after the learned map and the keywords: suggest categories for `Sem Categoria` rows and review existing picks using the user's own history as context. Suggestions only, never auto-applied. Best kept as a local tool (like `tools/category-benchmark/`) so no API key reaches the browser or the repo; the benchmark can score it against the keyword engine. Sending descriptions to an API is the user's call.
- **Budgets per category.** Monthly spending limits per expense category, shown against actual spending on the Balance Sheet.
- **Fees per holding.** An optional annual fee (MER) per holding, as information only — balances are already net of fees. The Investments & FIRE tab would show the portfolio's weighted average fee and its yearly cost, to spot expensive funds.
- **SQL storage.** Swap LocalStorage for a database; all persistence already goes through `storage.js`.
- **Transaction currencies and a display currency.** Store each transaction's original amount and currency, as balances already do, instead of converting to CAD on import. Settings gets a display currency (CAD by default, any currency with a rate), and every tab converts to it at the current rates. Needs a settings/backup version bump with a migration (existing transactions become CAD), a currency picker on Add Transaction, bank imports that keep the bank's currency, and a rule for totals and CSV export.
- **Older history import** (after transaction currencies). Import the spreadsheet years before the history already imported: transactions in their original currencies (some years mix two currencies in one sheet; each row's currency follows from its payment type and formulas), and the yearly balance sheets with the archived assets they need. The first imported months recorded in CAD should be re-imported in their original currencies too. Same rules as the earlier import: today's rates, end-of-month balances checked against each month's net result, totals checked against the workbooks.
- **Light-theme toggle.**
- **Asset reordering** in Settings (the Balance Sheet follows the Settings order).
