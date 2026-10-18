# Backlog

Work deliberately left out of a version, to be picked up by a future one. When an item is taken on, it moves into that version's `plan.md` and leaves this list.

## Features

- **Learned category map.** Remember the category of transactions already seen: a normalized `description → category` map (strip order ids and store numbers such as `AMAZON.CA*AB12CD34E` or `GROCER #1234`) that wins over the keyword engine, which stays the fallback for unseen merchants.
- **LLM categorizer.** A third layer after the learned map and the keywords: suggest categories for `Sem Categoria` rows and review existing picks using the user's own history as context. Suggestions only, never auto-applied. Best kept as a local tool (like `tools/category-benchmark/`) so no API key reaches the browser or the repo; the benchmark can score it against the keyword engine. Sending descriptions to an API is the user's call.
- **Budgets per category.** Monthly spending limits per expense category, shown against actual spending on the Balance Sheet.
- **Fees per holding.** An optional annual fee (MER) per holding, as information only — balances are already net of fees. The Investments & FIRE tab would show the portfolio's weighted average fee and its yearly cost, to spot expensive funds.
- **SQL storage.** Swap LocalStorage for a database; all persistence already goes through `storage.js`.
- **Light-theme toggle.**
- **Asset reordering** in Settings (the Balance Sheet follows the Settings order).
