# Backlog

Work deliberately left out of a version, to be picked up by a future one. When an item is taken on, it moves into that version's `plan.md` and leaves this list.

## Features

- **Learned category map.** Remember the category of transactions already seen: a normalized `description → category` map (strip order ids and store numbers such as `AMAZON.CA*AB12CD34E` or `GROCER #1234`) that wins over the keyword engine, which stays the fallback for unseen merchants.
- **LLM categorizer.** A third layer after the learned map and the keywords: suggest categories for `Sem Categoria` rows and review existing picks using the user's own history as context. Suggestions only, never auto-applied. Best kept as a local tool (like `tools/category-benchmark/`) so no API key reaches the browser or the repo; the benchmark can score it against the keyword engine. Sending descriptions to an API is the user's call.
- **Budgets per category.** Monthly spending limits per expense category, shown against actual spending on the Balance Sheet.
- **Retirement / FIRE projections.** A redesigned take on the old balance-sheet spreadsheet's projection sheet.
- **Per-month historical exchange rates.** Value each month's foreign-currency balances at that month's rate instead of the current Settings rate.
- **SQL storage.** Swap LocalStorage for a database; all persistence already goes through `storage.js`.
- **Light-theme toggle.**
- **Asset reordering** in Settings (the Balance Sheet follows the Settings order).

## Small fixes

- **Restore dialog:** closing it with × or the backdrop leaves the validated file in `pendingRestore` (`js/settings-ui.js`). Harmless, since only Confirm applies it, but it should be cleared.
- **Balance cell blur:** clicking a grid button while a balance cell is being edited commits the edit and re-renders, so the click is lost and has to be repeated.
- **Duplicate rows on FinTracker import:** `afterParse` registers a row's category in Settings before the duplicate check, so categories from skipped rows are still added.

## Tech debt

- **Magic strings:** category, type and account names repeated as string literals across modules.
- **Recursive `processFiles`** in `js/import-export.js`: correct and bounded by the number of files, but a loop would read more simply.
- **Accessibility:** tabs are keyboard-navigable; the grid, modals and forms have not had an accessibility pass.
