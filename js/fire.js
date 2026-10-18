// Pure model for the Investments & FIRE tab: where you stand against financial
// independence (FI) with the safe-withdrawal-rate rule, a yearly projection with a
// conservative tax drag, and allocation against target. No DOM or storage access.

import { ASSET_CLASSES, ASSET_TYPES, findHolding } from './settings.js';
import { knownEntries, rateTable, aggregateByMonth, monthKeysOf } from './balance-sheet.js';
import { monthKey } from './utils.js';

const DAYS_IN_YEAR = 365;
const DEFAULT_PROJECTION_YEARS = 20;
const TAXED_YEARLY = new Set(ASSET_TYPES.filter(type => type.taxedYearly).map(type => type.name));

const yearOf = key => Number(key.slice(0, 4));
const monthOf = key => Number(key.slice(5));
const december = year => `${year}-12`;
const sum = values => values.reduce((total, v) => total + v, 0);

// The 12 month keys ending at `key`, oldest first.
function lastTwelveMonths(key) {
    const year = yearOf(key);
    const month = monthOf(key);

    return Array.from({ length: 12 }, (_, i) => monthKey(new Date(year, month - 12 + i, 1)));
}

/**
 * Values of one month's balances in CAD, split into what counts toward FI.
 * @returns {{entries: {asset: object, value: number, split: object|undefined}[], missing: string[]}}
 */
function valuedMonth(balances, key, settings, assetsById, rates) {
    const missing = new Set();
    const entries = [];

    knownEntries(balances, key, assetsById).forEach(([id, amount]) => {
        const asset = assetsById.get(id);
        const rate = rates[asset.currency];

        if (!rate) {
            missing.add(asset.currency);

            return;
        }

        entries.push({ asset, value: amount * rate, split: findHolding(settings, asset.holding) });
    });

    return { entries, missing: [...missing].sort() };
}

// Counts toward FI: everything except the cash share of a holding's split; unclassified assets count in full.
const fiPart = ({ value, split }) => value * (1 - (split?.cash ?? 0) / 100);

function fiPortfolioOf(month) {
    return month.missing.length ? null : sum(month.entries.map(fiPart));
}

function flowsOf(byMonth, keys) {
    const months = keys.map(key => byMonth.get(key)).filter(Boolean);

    return {
        any: months.length > 0,
        income: sum(months.map(m => m.income)),
        expenses: sum(months.map(m => m.expenses))
    };
}

// With targets, percentages cover only the classes that have one (a 0% target included);
// without any, they cover every classified class.
function allocationOf(month, targets) {
    const classified = month.entries.filter(entry => entry.split);
    const hasTargets = Object.keys(targets).length > 0;
    const counted = key => !hasTargets || Object.hasOwn(targets, key);
    const values = ASSET_CLASSES.map(({ key }) => sum(classified.map(entry => entry.value * (entry.split[key] ?? 0) / 100)));
    const total = sum(values.filter((_, i) => counted(ASSET_CLASSES[i].key)));

    const rows = ASSET_CLASSES.map(({ key, label }, i) => {
        const value = values[i];
        const share = total && counted(key) ? value / total : null;
        const target = hasTargets && counted(key) ? targets[key] / 100 : null;

        return {
            key,
            label,
            value,
            share,
            target,
            drift: target !== null && share !== null ? share - target : null,
            // Nothing held in the targeted classes leaves no base to work an amount out from.
            toTarget: target !== null && total ? target * total - value : null
        };
    });

    return { rows, total, unclassified: sum(month.entries.filter(entry => !entry.split).map(entry => entry.value)), hasTargets };
}

const monthsWithBalancesOf = (balances, settings) => {
    const assetsById = new Map(settings.assets.map(asset => [asset.id, asset]));

    return Object.keys(balances).filter(key => knownEntries(balances, key, assetsById).length).sort();
};

/**
 * Income and expenses over the 12 months ending at the latest month with balances — the default retirement spending.
 * @param {{transactions: object[], balances: object, settings: object}} input
 * @returns {{firstMonth: string, latestMonth: string, spending: number, saved: number} | null} null without balances
 */
export function recentFlows({ transactions, balances, settings }) {
    const latestMonth = monthsWithBalancesOf(balances, settings).at(-1);

    return latestMonth ? flowsUpTo(aggregateByMonth(transactions), latestMonth) : null;
}

function flowsUpTo(byMonth, latestMonth) {
    const keys = lastTwelveMonths(latestMonth);
    const flows = flowsOf(byMonth, keys);

    return { firstMonth: keys[0], latestMonth, spending: flows.expenses, saved: flows.income - flows.expenses };
}

/**
 * The projection years used when Settings leaves them blank: the first year with balances
 * (this year without any) through 20 years from now.
 * @returns {{start: number, end: number}}
 */
export function defaultProjectionYears({ balances, settings, today }) {
    const first = monthsWithBalancesOf(balances, settings)[0];

    return { start: first ? yearOf(first) : today.getFullYear(), end: today.getFullYear() + DEFAULT_PROJECTION_YEARS };
}

/**
 * Builds everything the Investments & FIRE tab shows.
 * @param {{transactions: object[], balances: object, closedMonths: string[], settings: object, today: Date}} input
 * @returns {object} `{latestMonth: null}` without balances; `{latestMonth, missingRates}` when the latest
 *          month needs a rate that isn't set; otherwise the stats, projection, allocation and holdings
 */
export function buildFire({ transactions, balances, closedMonths, settings, today }) {
    const assetsById = new Map(settings.assets.map(asset => [asset.id, asset]));
    const latestMonth = monthsWithBalancesOf(balances, settings).at(-1) ?? null;

    if (!latestMonth) {
        return { latestMonth: null };
    }

    const rates = rateTable(settings);
    const valued = key => valuedMonth(balances, key, settings, assetsById, rates);
    const latest = valued(latestMonth);

    if (latest.missing.length) {
        return { latestMonth, missingRates: latest.missing };
    }

    const { fire } = settings;
    const byMonth = aggregateByMonth(transactions);
    const recent = flowsUpTo(byMonth, latestMonth);
    const spendingIsDefault = fire.retirementSpending === null;
    const spending = spendingIsDefault ? recent.spending : fire.retirementSpending;
    const { saved } = recent;
    const fiPortfolio = fiPortfolioOf(latest);
    const taxedPart = sum(latest.entries.filter(entry => TAXED_YEARLY.has(entry.asset.type)).map(fiPart));
    // Negative balances can push the ratio outside 0–1; the share of growth taxed can't be.
    const nonRegShare = fiPortfolio > 0 ? Math.min(Math.max(taxedPart / fiPortfolio, 0), 1) : 0;

    const withdrawal = spending / (1 - fire.withdrawalTax / 100);
    const fiNumber = spending > 0 ? withdrawal / (fire.swr / 100) : null;
    const achieved = fiNumber ? fiPortfolio / fiNumber : null;
    const freedomDays = achieved === null ? null : Math.floor(Math.min(Math.max(achieved, 0), 1) * DAYS_IN_YEAR);
    const latestYear = yearOf(latestMonth);

    const base = {
        latestMonth,
        fiPortfolio,
        nonRegShare,
        spending,
        defaultSpending: recent.spending,
        spendingIsDefault,
        saved,
        withdrawal,
        fiNumber,
        swrToday: fiNumber && fiPortfolio > 0 ? withdrawal / fiPortfolio : null,
        achieved,
        freedomDays,
        // The last day of the year the portfolio already pays for; Jan 1 is day 1.
        freedomLastDay: freedomDays ? new Date(latestYear, 0, freedomDays) : null,
        stillToFund: fiNumber ? Math.max(fiNumber - fiPortfolio, 0) : null,
        allocation: allocationOf(latest, settings.targets),
        holdings: [...latest.entries].sort((a, b) => b.value - a.value)
    };

    if (!fiNumber) {
        return { ...base, fiYear: null, fiAge: null, projection: null };
    }

    const projection = projectionRows({
        fire, closedMonths, byMonth, valued, latestMonth, fiPortfolio, saved, nonRegShare, withdrawal, fiNumber,
        defaults: defaultProjectionYears({ balances, settings, today })
    });
    const fiYear = fiPortfolio >= fiNumber ? 'reached' : projection.fiYear;

    return {
        ...base,
        fiYear,
        fiAge: typeof fiYear === 'number' && fire.birthYear !== null ? fiYear - fire.birthYear : null,
        projection: projection.rows,
        projectionEnd: projection.end
    };
}

function projectionRows({ fire, closedMonths, byMonth, valued, latestMonth, fiPortfolio, saved, nonRegShare, withdrawal, fiNumber, defaults }) {
    const start = fire.projectionStart ?? defaults.start;
    const end = fire.projectionEnd ?? defaults.end;
    const closed = new Set(closedMonths);
    const latestYear = yearOf(latestMonth);
    const expected = fire.expectedReturn / 100;
    const inflation = 1 + fire.inflation / 100;
    // In today's dollars: growth after inflation, and the yearly tax on the non-registered share of nominal growth.
    const growthRate = (1 + expected) / inflation - 1;
    // A loss has no tax to drag it further.
    const dragRate = Math.max(expected, 0) * nonRegShare * (fire.nonRegTaxDrag / 100) / inflation;
    const ageOf = year => (fire.birthYear === null ? null : year - fire.birthYear);
    const rows = [];
    // The first open or projected year to reach the FI number, even one before the start year; none when already there.
    let fiYear = null;
    let fiFound = fiPortfolio >= fiNumber;

    const row = (year, kind, values) => {
        const fi = !fiFound && kind !== 'actual' && kind !== 'none' && values.end >= fiNumber;

        if (fi) {
            fiFound = true;
            fiYear = year;
        }

        return {
            year, kind, age: ageOf(year), start: null, growth: null, taxDrag: null, saved: null, end: null,
            ...values,
            swr: values.end ? withdrawal / values.end : null,
            fi
        };
    };

    const projected = (year, kind, startValue, months) => {
        const fraction = months / 12;
        const growth = startValue * growthRate * fraction;
        const taxDrag = startValue * dragRate * fraction;
        const yearSaved = saved * fraction;

        return row(year, kind, { start: startValue, growth, taxDrag, saved: yearSaved, end: startValue + growth - taxDrag + yearSaved });
    };

    const fiPortfolioAt = key => fiPortfolioOf(valued(key));

    for (let year = start; year <= Math.min(end, latestYear); year++) {
        if (closed.has(december(year))) {
            const endValue = fiPortfolioAt(december(year));
            const startValue = closed.has(december(year - 1)) ? fiPortfolioAt(december(year - 1)) : null;
            const flows = flowsOf(byMonth, monthKeysOf(year));
            const yearSaved = flows.any ? flows.income - flows.expenses : null;
            const known = [startValue, endValue, yearSaved].every(value => value !== null);

            rows.push(row(year, 'actual', { start: startValue, end: endValue, saved: yearSaved, growth: known ? endValue - startValue - yearSaved : null }));
        } else if (year < latestYear) {
            rows.push(row(year, 'none', {}));
        }
    }

    // The latest year: actual when its December is closed, otherwise open with its remaining months projected.
    const latestClosed = closed.has(december(latestYear));
    const open = latestClosed ? null : projected(latestYear, 'open', fiPortfolio, 12 - monthOf(latestMonth));

    if (open && latestYear >= start && latestYear <= end) {
        rows.push(open);
    }

    let running = open ? open.end : fiPortfolio;

    for (let year = latestYear + 1; year <= end; year++) {
        const next = projected(year, 'projected', running, 12);
        running = next.end;

        if (year >= start) {
            rows.push(next);
        }
    }

    return { rows, end, fiYear };
}
