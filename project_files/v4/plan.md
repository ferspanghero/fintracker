# v4 Implementation Plan — Investments & FIRE

## Goal

Replace the old balance-sheet workbook's retirement sheet with an **Investments & FIRE** tab built on the data FinTracker already holds. It shows where you stand against financial independence (FI) using the 4% rule, projects the year you get there with a deliberately conservative tax drag, tracks allocation drift against target percentages, and keeps RRSP/TFSA room per person per year. Wherever possible a figure comes from the Balance Sheet and transactions, not from typed inputs.

## User Experience

### Layout

Tabs become **Transactions | Balance Sheet | Investments & FIRE | Settings**. The new tab is read-only except for registered room, and is laid out top to bottom:

| Section | Content |
|---|---|
| **Where you stand** | Four stats: FI portfolio, FI number, SWR today, FI year (with age). Heading names the latest month with balances. |
| **Progress to FI** | Bar of FI portfolio vs FI number; FI achieved %, freedom days (of 365), freedom calendar ("Jan 1 → Aug 21 paid for · Aug 22 → Dec 31 needs $675,000 more"). |
| **Projection** | One row per year from the projection start year to the end year (Settings): Year, Age, Start, Change (End − Start), Tax drag, End, SWR; the yearly saving it assumes is listed under Assumptions. Actual, open and projected years styled like closed/open months (below). |
| **Allocation vs target** | One row per asset class: Current (CAD), Current %, Target %, Drift, To reach target ("buy $22,500" / "sell $2,500" / "on target"), a bar with a target mark. An **Unclassified** row when some assets have no class split. |
| **Holdings** | One row per asset with a balance in the latest month: generated name + currency badge, class split summary ("US 60 / Intl 30 / EM 10" or "Unclassified"), balance in CAD; largest first. |
| **Registered room** | Year selector; one row per account (RRSP, TFSA) × person: Room and Contributed inputs, Left computed, warnings. |
| **Assumptions** | Read-only summary of the FIRE inputs, "edit in Settings". |

The tab doesn't repeat Balance Sheet indicators (saving rate, net worth).

### Projection row styles

| Row | Year cell | Values |
|---|---|---|
| **Actual** — a year whose December is closed on the Balance Sheet | Dark green, label "ACTUAL" (closed-month header) | Normal text on the closed-month tint; Tax drag "—" |
| **No data** — a year up to the latest month's year whose December isn't closed, other than the open year | Plain | Every value "—" |
| **Open** — the latest month's year when its December isn't closed | Grey, label "OPEN" | Italic muted; Start (the latest month's actual value, tagged with the month) in normal text |
| **Projected** — every year after the latest month's year | Grey, label "PROJECTED" | Italic muted |
| **FI year** — first open/projected row whose End ≥ FI number | Same as its kind | End and SWR bold, green "FI" badge |

### Hover explanations

Every stat, column header, assumption and row-kind label carries a plain-language explanation. A dotted underline marks the term; the explanation appears after a 1-second hover or immediately on focus (keyboard or a tap), and Escape hides it until the pointer or focus moves to a term again. The same texts appear beside the FIRE inputs in Settings. Example: **FI number** — "How much you need so that withdrawing your SWR each year pays for your spending and the tax on what you withdraw. Reach it and work becomes optional."

### Settings tab additions

- **Assets** table gains **Type**, **Institution**, **Owner** and **Holding** columns. With a Type set, the name is generated as `{Type} {Institution} - {Owner} - {Holding}` (blank parts skipped) and shown read-only; with no Type the name stays free text. The add form gets the same fields.
- **Hide archived** (checked by default, not saved) above the Assets table hides archived assets and shows how many are hidden.
- **Asset classes**: one row per distinct holding (from the assets) with a % per class and a Total that must reach 100%; a **Target** row with the same columns.
- **FIRE assumptions**: SWR (4%), Withdrawal tax (20%), Retirement spending (blank = your expenses over the last 12 months), Expected return (7%), Inflation (2%), Non-reg tax drag (10%), Birth year (blank), Projection start year and end year (blank = the first year with balances, and the current year + 20).
- **Worked-out defaults look like open months**: a blank input that falls back to a value worked out from your data shows that value as a grey italic placeholder, and its explanation states the value (e.g. "Right now that is $60,000 (Jan 2026 – Dec 2026)"). Typing a value overrides it; clearing it goes back. The tab's Assumptions show such defaults in the same grey italics.

### Transactions tab addition

The Date Range filter gains **Select Year**, which shows a Year selector listing the years with transactions, newest first, and filters the table and summary to the chosen year (Jan 1 – Dec 31). The list follows imports and restores without changing the chosen year; picking Select Year again falls back to the newest year when the chosen one no longer has transactions.

### Primary workflow

1. Monthly close on the Balance Sheet as today.
2. Open **Investments & FIRE**: stats, progress and projection reflect the new month; check drift and the "to reach target" amounts before investing.
3. When a notice of assessment or CRA room arrives, enter the year's room; record contributions as they happen.

## Architecture

```
index.html ─ tabs ─┬─ Transactions (+ Select Year filter) · Balance Sheet (unchanged)
                   ├─ Investments & FIRE ── fire-ui.js ──► fire.js (pure model)
                   │                                      registered-room.js (pure rules)
                   │                                      explanations.js (texts + tip markup)
                   └─ Settings ─────────── settings-ui.js ─► settings.js (asset fields, splits, targets, FIRE inputs)
balance-sheet.js: exports aggregateByMonth / rateTable for fire.js (no behaviour change)
state.js:  + registeredRoom{}
storage.js: + key registeredRoom; saveRegisteredRoom() writes only that key
backup.js: version 2 (settings v2 + registeredRoom); version 1 still restores
```

### Data model

```js
// LocalStorage "settings" — version 2
{
  version: 2,
  rates, categories,                                    // unchanged
  assets: [{ id, name, currency, archived,
             type: 'RRSP' | 'RRSP/DPSP' | 'Spousal RRSP' | 'TFSA' | 'Non-registered' | 'Stocks' | 'Savings' | 'Chequing' | 'Real estate' | null,
             institution: '', owner: '', holding: '' }],
  holdings: [{ name: 'GLOBAL-ETF', split: { usEquity: 60, intlEquity: 30, emEquity: 10 } }],   // matched to assets by holding, ignoring case
  targets: { fixedIncome: 10, canadaEquity: 25, usEquity: 35, intlEquity: 15, emEquity: 5, realEstate: 5, cash: 5 } | {},
  fire: { swr: 4, withdrawalTax: 20, retirementSpending: null,   // null = last 12 months of expenses
          expectedReturn: 7, inflation: 2, nonRegTaxDrag: 10, birthYear: null,
          projectionStart: null, projectionEnd: null }          // e.g. 2017 and 2037
}
// LocalStorage "registeredRoom" — CAD; an absent entry = blank inputs
[{ year: 2026, account: 'RRSP' | 'TFSA', person: 'Alex', room: 30000, contributed: 24000 }]
```

- **Asset classes** (`ASSET_CLASSES` in `settings.js`, in display order): Fixed Income / Bonds, Canada Equity, US Equity, Intl Equity, Emerging Markets Equity, Real Estate, Cash.
- **Asset types** (`ASSET_TYPES`): each has `taxedYearly` — true for Non-registered, Stocks, Savings, Chequing; false for RRSP, RRSP/DPSP, Spousal RRSP, TFSA, Real estate.
- **Targets**: a class with no target is left out of the allocation percentages; a 0% target counts (you want none of it).
- **Holdings and room entries are lists**, so names typed by the user (holdings, people) never become object keys.
- **Loading v1 settings** goes through pure `migrateSettings(saved)`: fills the new fields with defaults and sets `version: 2` in memory; loading still never writes.
- **People** for registered room: distinct non-blank owners of active RRSP, RRSP/DPSP and TFSA assets, excluding "Joint" (any case). RRSP and RRSP/DPSP share the RRSP row. A Spousal RRSP's owner gets no row: its contributions count against the contributor's room and are entered under the contributor.

### Backup file

`version: 2`, adds `registeredRoom`; settings as above. Validation (errors collected, nothing applied on failure) adds: asset `type` in `ASSET_TYPES` or null, `institution`/`owner`/`holding` strings, generated names still unique; each holding split has known class keys, finite values 0–100 summing to 100 (±0.01); `targets` empty or the same rule; `fire` numbers in range (SWR > 0 and ≤ 100, withdrawal tax and drag 0 to < 100, return finite, inflation finite and above −100, birth year and projection start/end integers 1900–2100 or null (end after start), retirement spending finite ≥ 0 or null — a `spendingMode`/`fixedSpending` pair saved during development is read as the override); room entries with a whole year 1900–2100, account RRSP/TFSA, a non-blank person, values finite ≥ 0 or null, and no duplicate year/account/person. The restore summary counts room entries when there are any. A version 1 backup is accepted, migrated with `migrateSettings`, and restores with empty room data.

## Phase 1 — Settings model & storage

- `js/settings.js`: `SETTINGS_VERSION = 2`, `ASSET_TYPES`, `ASSET_CLASSES`, `migrateSettings`, `assetName(asset)`; `setAssetDetails(settings, id, { type, institution, owner, holding })` (regenerates the name, rejects a duplicate); `addAsset` accepts the details; `setHoldingSplit(settings, holding, split)`, `setTargets(settings, targets)` (sum must be 100), `setFireInput(settings, field, raw)` with range checks. All return `{ ok, error }` and mutate only on success.
- `js/state.js`: `registeredRoom` export; `replaceAll` covers it.
- `js/storage.js`: load/save `registeredRoom`; settings pass through `migrateSettings`; `saveRegisteredRoom()`.
- `js/backup.js`: version 2 build/validate as above; version 1 accepted.

## Phase 2 — FIRE model (`js/fire.js`, pure)

`buildFire({ transactions, balances, closedMonths, settings, today })` returns `{ latestMonth: null }` without balances, `{ latestMonth, missingRates }` when the latest month needs a missing rate, and otherwise the stats (`fiPortfolio`, `fiNumber`, `swrToday`, `fiYear`, `fiAge`…), progress, `projection` rows, `allocation` and `holdings`. Room rows come from `registered-room.js`.

- **Latest month**: newest month key with balances for known assets; none → `{ latestMonth: null }` and the UI shows an empty state.
- **CAD values** via the Balance Sheet's rate table; a balance in a currency without a rate puts the currency in `missingRates` and the dependent figures are null.
- **FI portfolio** = Σ CAD value × (1 − cash share of its holding's split); unclassified assets count in full.
- **Last 12 months**: the 12 month keys ending at the latest month. Spending = Σ expenses, saved = Σ income − Σ expenses, from `aggregateByMonth`.
- **Stats**: spending = the retirement spending override, or the last 12 months' expenses when it is blank; withdrawal = spending ÷ (1 − tax); FI number = withdrawal ÷ SWR (null when spending is 0); SWR today = withdrawal ÷ FI portfolio; FI achieved = FI portfolio ÷ FI number; freedom days = ⌊min(achieved, 1) × 365⌋; freedom calendar = the last day already paid for, Jan 1 + freedom days − 1 (none at 0 days; Dec 31 at 365); still to fund = max(FI number − FI portfolio, 0).
- **Non-reg share** = FI-portfolio value of `taxedYearly` assets ÷ FI portfolio, kept within 0–1 (0 when the FI portfolio isn't positive).
- **Projection** (real return r = (1 + R) ÷ (1 + i) − 1; drag rate d = max(R, 0) × share × t ÷ (1 + i)):
  - one row per year from the projection start year to the end year (row kinds as in User Experience);
  - every row: Change = End − Start ("—" when either is unknown);
  - actual rows: Start = previous December's FI portfolio when that December is closed, else "—"; End = this December's; Tax drag "—" (real taxes are already in the actual numbers);
  - no-data rows: every value "—";
  - open row: Start = latest month's FI portfolio, the remaining m = 12 − month months: End = Start + Start × r × m/12 − Tax drag + yearly saving × m/12, with Tax drag = Start × d × m/12;
  - projected rows: Start = the previous row's End; End = Start + Start × r − Tax drag + yearly saving, with Tax drag = Start × d;
  - yearly saving = income − expenses over the last 12 months (shown under Assumptions); SWR = withdrawal ÷ End; Age = year − birth year;
  - FI year = the first open/projected row with End ≥ FI number; rows continue to the end year; none → "Not reached by {end year}"; FI portfolio already ≥ FI number → FI year "Reached".
- **Allocation**: each classified asset's CAD value spread by its split. With targets, the base is the total of the classes that have one (a 0% target included); classes without one show their value and "—". Current % = value ÷ base; Drift = Current % − Target %; To reach target = Target % × base − Current ("—" when the base is 0). Unclassified row (value only) when any asset lacks a split. No targets → percentages of everything classified; Target/Drift/To reach show "—".
- **Holdings**: assets with a latest-month balance, largest CAD value first.

## Phase 3 — Registered room (`js/registered-room.js`, pure)

- `roomPeople(settings)` and `roomRows(registeredRoom, settings, year)` → rows `{ account, person, room, contributed, left, warning }`.
- `setRoomValue(registeredRoom, { year, account, person, field }, raw)`: blank clears (an entry with both values blank is removed), commas are thousands separators, negative or non-numeric rejected.
- `roomEntriesErrors(entries)` validates stored entries for Restore.
- Warnings: RRSP Left < 0 → "over by $X"; below −$2,000 → "over the $2,000 allowance — CRA charges 1% a month"; TFSA Left < 0 → "over by $X — CRA charges 1% a month".
- Years offered: years present in the data plus the current year, newest first; default the current year.

## Phase 4 — UI

- `js/explanations.js`: the explanation texts (one map used by the tab and Settings) and `tip(key, label)` returning the term markup — a focusable `span.tip` with `aria-describedby` pointing to a `role="tooltip"` element.
- `js/fire-ui.js`: renders every section from `buildFire`; room inputs save on change through `setRoomValue` + `saveRegisteredRoom()` and update their row in place, so focus stays where the user moved it; empty state ("Enter balances on the Balance Sheet to see where you stand") and missing-rate note ("Set rates in Settings").
- `js/settings-ui.js`: asset detail columns and add form; Asset classes table (holdings + Target, Total cell flags ≠ 100% and a split is saved once it adds up); FIRE assumptions form with explanations. Detail, split and FIRE edits update in place rather than re-rendering, so focus isn't lost.
- `index.html`, `js/dom.js`, `js/tabs.js` wiring, `js/main.js` render on activation; `styles.css` for row kinds, FI badge, progress bar, tips (reusing the Balance Sheet's closed/open tokens).
- `js/ui.js`, `js/events.js`: the Select Year filter and its year list.

## Phase 5 — End-to-end tests (Playwright)

`tests/e2e/investments.spec.js` covering the scenarios below with synthetic data and the fixed clock; Settings additions extend `tests/e2e/settings.spec.js` and the year filter `tests/e2e/transactions.spec.js`. Spec titles carry a `v4` prefix (`v4 E17 — …`) to tell them from v3's scenario ids.

## Phase 6 — Docs

- `README.md`: the new tab and Settings sections.
- `CLAUDE.md`: new modules, storage key, settings migration rule.
- `project_files/overview.md`: architecture, data model, backup version.
- `project_files/backlog.md`: remove the Retirement / FIRE item.

## Phase 7 — Milestone: history import 2017–2024 (after v4 ships)

A separate milestone once Phases 1–6 are done: convert the old yearly balance-sheet workbooks and expense workbooks (local and untracked, formats evolving over the years) into one FinTracker backup file, merged with the current data and settings, so the projection's 2017–2024 rows show as actual years after a Restore. The last months of the year before are included, so the first projection year has a Start. Like v3's history import, the converter is a set of one-off scripts kept in the gitignored `resources/` with their output; nothing from it is committed.

How each concern was settled:

- **Old transactions** — every individual transaction from the expense workbooks; each year's income and expense totals are checked against the workbooks.
- **Old file formats** — the legacy `.xls` workbooks are re-saved as `.xlsx` with the local Excel; no library installed.
- **Asset names changed over the years** — mapped onto current assets; accounts that no longer exist become archived assets with Type, Institution, Owner and Holding.
- **Exchange rates** — balances are imported in each account's own currency and valued at the current Settings rates, like every other balance, even where the workbooks recorded the CAD value at the time.
- **Month-end balances** — a workbook's month column is taken as that month's closing balance after checking that each month's net worth change matches its net result, whatever its row label says.
- **Liabilities** — a mortgage is folded into its property's balance as equity; there are no other liabilities.
- **Categories** — old category names mapped onto the current list; income left as "other" is routed by its description (refunds → the refund category, tax returns → work income).
- **Closed months** — every imported month is marked closed, so those years show as ACTUAL.
- **Merge** — Restore replaces all data, so the import starts from a backup downloaded just before and keeps its later data and settings unchanged.

Earlier years, and keeping each transaction's original currency, are in [`project_files/backlog.md`](../backlog.md).

## File Manifest

```
index.html styles.css                                   (modified)
js/
  fire.js registered-room.js explanations.js fire-ui.js (new; first three pure)
  settings.js settings-ui.js backup.js storage.js state.js
  balance-sheet.js dom.js tabs.js main.js
  ui.js events.js categories.js                         (modified)
tests/
  fire.test.js registered-room.test.js explanations.test.js fire-ui.test.js   (new)
  settings.test.js settings-ui.test.js backup.test.js storage.test.js state.test.js
  ui.test.js events.test.js categories.test.js integration.test.js             (updated)
  e2e/investments.spec.js                               (new)
  e2e/settings.spec.js e2e/transactions.spec.js e2e/helpers.js   (updated)
README.md CLAUDE.md project_files/overview.md project_files/backlog.md      (modified)
```

## Verification

1. `npm test` — all unit and integration tests pass.
2. `npm run test:coverage` — lines/statements/functions ≥ 90%, branches ≥ 85%.
3. `npm run test:e2e` — all Playwright specs pass.
4. Manual: `npx serve . -l 3000`, restore a backup, fill asset details, splits and targets, compare the tab's figures with a hand calculation.

## Test Scenarios

- **E1** — Empty state: no balances → the tab shows "Enter balances on the Balance Sheet to see where you stand" and no sections.
- **E2** — Stats: latest month has an equity asset 1,200,000 and cash 50,000; last 12 months expenses 60,000; SWR 4%, tax 20% → FI portfolio $1,200,000, FI number $1,875,000, SWR today 6.25%.
- **E3** — Progress: same data → FI achieved 64.0%, freedom days 233, freedom calendar "Jan 1 → Aug 21 paid for · Aug 22 → Dec 31 needs $675,000 more".
- **E4** — Spending override: Settings shows the last-12-months spending (60,000) in grey; type 40,000 → FI number $1,250,000 regardless of transactions; clear it → back to $1,875,000.
- **E5** — Projection years: start 2017, end 2037, closed Decembers only in the last two years → 21 rows; years before those show "—"; the last row is 2037.
- **E6** — Projection: latest month Sep, return 7%, inflation 2%, drag 10%, all non-registered → open row projects 3 months; projected rows follow; the first End ≥ FI number is badged FI and matches the FI year stat.
- **E7** — Actual years: closed Decembers in the two previous years → two ACTUAL rows with Start, Change (+$200,000 for $800,000 → $1,000,000) and End; Tax drag "—". The first of them has Start and Change "—" when the December before it isn't closed.
- **E8** — Unclosed December: a previous year with December balances but not closed → a no-data row with every value "—".
- **E9** — December latest: latest month is December and closed → that year is ACTUAL and the projection starts the next year with full years; not closed → OPEN with nothing left to project (End = Start, Change $0).
- **E10** — Already FI: FI portfolio above the FI number → FI year "Reached", progress 100%, freedom calendar "Jan 1 → Dec 31 paid for".
- **E11** — Never reached: negative yearly saved and zero return → "Not reached by 2037" with end year 2037.
- **E12** — Zero spending: no expenses and no override → FI number "—", dependent stats "—", no projection.
- **E13** — Missing rate: USD asset with a balance, USD rate empty → "Set rates in Settings", affected figures "—".
- **E14** — Class split: holding split 60/30/10 US/Intl/EM on a 100,000 asset → Allocation shows 60,000 / 30,000 / 10,000 in those classes.
- **E15** — Drift: targets set, US Equity current 30.4% vs target 32.0% → Drift −1.6%, "buy $…" equal to the gap; a class on target shows "on target"; a class without a target shows "—"; a 0% target shows 0.0%.
- **E16** — Unclassified: one asset without a split → Unclassified row in Allocation, "Unclassified" in Holdings, and the asset still counted in the FI portfolio.
- **E17** — Generated name: set Type RRSP, Institution Broker, Owner Alex, Holding ETF1 → name "RRSP Broker - Alex - ETF1", read-only; clearing Type makes the name editable again.
- **E18** — Duplicate generated name: details that would produce an existing asset's name → error shown, nothing changed.
- **E19** — Split total: a holding split adding to 90% → Total flagged, not saved; 100% → saved.
- **E20** — Registered room: enter RRSP room 30,000 and contributed 24,000 for a person → Left $6,000; contributed 31,500 → "over by $1,500"; 33,000 → the $2,000-allowance warning.
- **E21** — TFSA over: contributed above room by $100 → "over by $100 — CRA charges 1% a month".
- **E22** — Room people: owners of RRSP and TFSA assets plus a "Joint" non-registered asset → rows for each person, none for Joint; room values persist after reload.
- **E23** — Hover explanation: hover "FI number" 1 s → explanation visible; Escape → hidden; Tab to it → visible at once; click another term → visible at once.
- **E24** — Backup round trip v2: seeded settings, splits, targets, FIRE inputs and room → Download → clear → Restore → identical data.
- **E25** — Restore v1 backup: a version 1 file → restores; assets have no details, room empty, FIRE inputs at defaults.
- **E26** — Invalid v2 backup: a split adding up to 120% and room year "26" → both errors listed, data unchanged.
- **E27** — Non-reg share: half of the FI portfolio in Non-registered assets, half in TFSA → Assumptions show Non-reg share 50% (computed) and the tax drag uses it.
- **E28** — Hide archived: one active and one archived asset → Settings lists only the active one with "(1 hidden)"; uncheck → both; archive the other and check again → none, "(2 hidden)".
- **E29** — Year filter: transactions in two years → Date Range "Select Year" shows a year selector listing those years, newest first, and filters the table and summary to the newest; choosing the other year filters to it; another range hides the selector.

## Implementation Order

```
Phase 1 (settings model, storage, backup) → Phase 2 (fire.js) ─┬→ Phase 4 (UI) → Phase 5 (E2E) → Phase 6 (docs) ⇒ v4 ships
                                          → Phase 3 (room)  ───┘
Phase 7 (history import milestone) — later, on its own
(explanations.js is independent and can be built any time before Phase 4; Phases 2 and 3 are parallel)
```

## Out of Scope

Coast FI. Fees per holding and budgets per category are deferred to [`project_files/backlog.md`](../backlog.md).
