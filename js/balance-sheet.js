// Pure Balance Sheet model: combines per-month asset balances with income and
// spending derived from transactions. No DOM or storage access; callers pass
// all data plus `today` so results are deterministic.

import { monthKey } from './utils.js';

const MONTH_KEY = /^\d{4}-(0[1-9]|1[0-2])$/;
// Plain decimals with optional comma thousands separators: "1234.5", "-1,234,567.89", ".5".
// Anything else (a decimal comma, "1.234,56", hex, exponents) is refused rather than misread.
const BALANCE_INPUT = /^-?(?=\.?\d)(\d{1,3}(,\d{3})+|\d*)(\.\d+)?$/;

/** @returns {boolean} whether `key` is a 'YYYY-MM' month key */
export function isMonthKey(key) {
    return typeof key === 'string' && MONTH_KEY.test(key);
}

/** @returns {string} the 'YYYY-MM' key of the month before `key` */
export function previousMonthKey(key) {
    const [year, month] = key.split('-').map(Number);

    return monthKey(new Date(year, month - 2, 1));
}

const monthKeysOf = year => Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
const sum = values => values.reduce((total, v) => total + (v ?? 0), 0);
const mean = values => (values.length ? sum(values) / values.length : null);

// Balance entries for assets that exist in settings (unknown ids are ignored).
function knownEntries(balances, key, assetsById) {
    return Object.entries(balances[key] ?? {}).filter(([id]) => assetsById.has(id));
}

function rateTable(settings) {
    return { CAD: 1, USD: settings.rates.USD, BRL: settings.rates.BRL };
}

// Net worth of one month in CAD: null when the month has no entries or uses a currency without a rate.
function netWorthOf(balances, key, assetsById, rates, missing) {
    const entries = knownEntries(balances, key, assetsById);

    if (!entries.length) {
        return null;
    }

    let total = 0;

    for (const [id, value] of entries) {
        const { currency } = assetsById.get(id);

        if (!rates[currency]) {
            missing.add(currency);

            return null;
        }

        total += value * rates[currency];
    }

    return total;
}

// Per-month transaction sums: key → { income, expenses, byCategory: Map(category → expense sum) }.
function aggregateByMonth(transactions) {
    const months = new Map();

    transactions.forEach(({ date, amount, type, category }) => {
        const key = monthKey(date);

        if (!months.has(key)) {
            months.set(key, { income: 0, expenses: 0, byCategory: new Map() });
        }

        const month = months.get(key);

        if (type === 'income') {
            month.income += amount;
        } else {
            month.expenses += amount;
            month.byCategory.set(category, (month.byCategory.get(category) ?? 0) + amount);
        }
    });

    return months;
}

// A flow row: monthly values (null after the current month) plus Total, Average
// over the year's closed months, the previous year's closed-month average and Diff %.
function flowRow({ year, currentKey, closed, valueOf }) {
    const monthValues = y => monthKeysOf(y).map(key => (key <= currentKey ? valueOf(key) : null));
    const closedAverage = y => mean(monthKeysOf(y).filter(key => closed.has(key) && key <= currentKey).map(valueOf));

    const average = closedAverage(year);
    const prevAverage = closedAverage(year - 1);
    // Relative to the size of the previous average so a negative base keeps the sign meaningful.
    const diffPct = average !== null && prevAverage ? (average - prevAverage) / Math.abs(prevAverage) : null;
    const values = monthValues(year);

    return { values, total: sum(values), average, prevAverage, diffPct };
}

/**
 * Builds everything the Balance Sheet shows for one year.
 * @param {{year: number, transactions: object[], balances: object, closedMonths: string[], settings: object, today: Date}} input
 * @returns {{months: object[], assetRows: object[], netWorth: (number|null)[], missingRates: string[],
 *            income: object, expenses: object[], totalExpenses: object, netIncome: object, indicators: object}}
 */
export function buildYear({ year, transactions, balances, closedMonths, settings, today }) {
    const keys = monthKeysOf(year);
    const currentKey = monthKey(today);
    const closed = new Set(closedMonths);
    const assetsById = new Map(settings.assets.map(asset => [asset.id, asset]));
    const rates = rateTable(settings);
    const hasBalances = key => knownEntries(balances, key, assetsById).length > 0;
    const hasActiveBalances = key => knownEntries(balances, key, assetsById).some(([id]) => !assetsById.get(id).archived);

    const copyIndex = keys.findIndex(key => key <= currentKey && !hasBalances(key) && hasActiveBalances(previousMonthKey(key)));
    const months = keys.map((key, i) => ({
        key,
        closed: closed.has(key),
        hasBalances: hasBalances(key),
        canCopyPrevious: i === copyIndex
    }));

    const assetRows = settings.assets
        .filter(asset => keys.some(key => balances[key]?.[asset.id] !== undefined) || (!asset.archived && year >= today.getFullYear()))
        .map(asset => {
            const values = keys.map(key => balances[key]?.[asset.id] ?? null);
            const rate = rates[asset.currency];

            return { asset, values, cad: values.map(v => (v === null || !rate ? null : v * rate)) };
        });

    const missing = new Set();
    const netWorth = keys.map(key => netWorthOf(balances, key, assetsById, rates, missing));

    const byMonth = aggregateByMonth(transactions);
    const row = valueOf => flowRow({ year, currentKey, closed, valueOf });
    const income = row(key => byMonth.get(key)?.income ?? 0);
    const expenses = settings.categories.expense.map(category => ({
        category,
        ...row(key => byMonth.get(key)?.byCategory.get(category) ?? 0)
    }));
    const totalExpenses = row(key => byMonth.get(key)?.expenses ?? 0);
    const netIncome = row(key => (byMonth.get(key)?.income ?? 0) - (byMonth.get(key)?.expenses ?? 0));

    const startMonth = Object.keys(balances).filter(key => key < keys[0] && hasBalances(key)).sort().at(-1) ?? null;
    const currentMonth = keys.filter(hasBalances).at(-1) ?? null;
    const startNetWorth = startMonth && netWorthOf(balances, startMonth, assetsById, rates, missing);
    const currentNetWorth = currentMonth && netWorthOf(balances, currentMonth, assetsById, rates, missing);
    const change = startNetWorth !== null && currentNetWorth !== null ? currentNetWorth - startNetWorth : null;
    const saved = income.total - totalExpenses.total;
    // Returns compare the net worth change with what was saved over the same months
    // (after startMonth, up to currentMonth), not with the whole year so far.
    const savedOverChange = [...byMonth]
        .filter(([key]) => key > startMonth && key <= currentMonth)
        .reduce((total, [, month]) => total + month.income - month.expenses, 0);

    return {
        months,
        assetRows,
        netWorth,
        missingRates: [...missing].sort(),
        income,
        expenses,
        totalExpenses,
        netIncome,
        indicators: {
            startMonth,
            startNetWorth,
            currentMonth,
            currentNetWorth,
            change,
            changePct: change !== null && startNetWorth ? change / startNetWorth : null,
            totalIncome: income.total,
            totalExpenses: totalExpenses.total,
            saved,
            returns: change !== null ? change - savedOverChange : null,
            savingRate: income.total ? saved / income.total : null,
            expenseChangePct: totalExpenses.diffPct
        }
    };
}

/**
 * Sets or clears one balance from user input. Blank clears it; commas are read as thousands separators.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function setBalance(balances, key, assetId, raw) {
    if (!isMonthKey(key)) {
        return { ok: false, error: `Invalid month "${key}".` };
    }

    const text = String(raw ?? '').trim();

    if (!text) {
        if (balances[key]) {
            delete balances[key][assetId];

            if (!Object.keys(balances[key]).length) {
                delete balances[key];
            }
        }

        return { ok: true };
    }

    const value = BALANCE_INPUT.test(text) ? Number(text.replace(/,/g, '')) : NaN;

    if (!Number.isFinite(value)) {
        return { ok: false, error: 'Enter a number, or leave it blank to clear.' };
    }

    balances[key] = { ...balances[key], [assetId]: value };

    return { ok: true };
}

/**
 * Copies the previous month's balances of non-archived assets into `key`, keeping values already there.
 * @returns {{ok: true, copied: number}}
 */
export function copyPreviousMonth(balances, key, settings) {
    const previous = balances[previousMonthKey(key)] ?? {};
    const target = { ...balances[key] };
    let copied = 0;

    settings.assets
        .filter(asset => !asset.archived && previous[asset.id] !== undefined && target[asset.id] === undefined)
        .forEach(asset => {
            target[asset.id] = previous[asset.id];
            copied++;
        });

    if (Object.keys(target).length) {
        balances[key] = target;
    }

    return { ok: true, copied };
}

/**
 * Closes an open month or reopens a closed one, keeping the list sorted.
 * @returns {boolean} whether the month is now closed
 */
export function toggleClosed(closedMonths, key) {
    const index = closedMonths.indexOf(key);

    if (index !== -1) {
        closedMonths.splice(index, 1);

        return false;
    }

    closedMonths.push(key);
    closedMonths.sort();

    return true;
}

/**
 * Years with balances or transactions, plus the current year.
 * @returns {number[]} newest first
 */
export function availableYears({ transactions, balances, today }) {
    const years = new Set([today.getFullYear()]);

    Object.keys(balances).forEach(key => years.add(Number(key.slice(0, 4))));
    transactions.forEach(({ date }) => years.add(date.getFullYear()));

    return [...years].sort((a, b) => b - a);
}
