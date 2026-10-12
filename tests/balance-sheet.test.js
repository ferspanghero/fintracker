import { describe, it, expect } from 'vitest';
import {
    buildYear, setBalance, copyPreviousMonth, toggleClosed, availableYears, previousMonthKey, isMonthKey
} from '../js/balance-sheet.js';
import { emptySettings } from '../js/settings.js';
import { UNCATEGORIZED } from '../js/category-engine.js';

const TODAY = new Date(2026, 9, 11, 12, 0);

function makeSettings({ assets = [], rates = {}, expense = ['Casa', 'Mercado'], income = ['Trabalho'] } = {}) {
    const settings = emptySettings();
    settings.assets = assets.map(([id, currency, archived = false]) => ({ id, name: id, currency, archived }));
    Object.assign(settings.rates, rates);
    settings.categories = { expense: [...expense, UNCATEGORIZED], income: [...income, UNCATEGORIZED] };

    return settings;
}

const tx = (y, m, d, amount, type, category) => ({ date: new Date(y, m - 1, d), description: 'x', amount, type, category, account: 'A' });

function build(overrides = {}) {
    return buildYear({
        year: 2026,
        transactions: [],
        balances: {},
        closedMonths: [],
        settings: makeSettings(),
        today: TODAY,
        ...overrides
    });
}

describe('month keys', () => {
    it.each([
        ['2026-01', '2025-12'],
        ['2026-10', '2026-09']
    ])('previous of %s is %s', (key, expected) => {
        // Act, Assert
        expect(previousMonthKey(key)).toBe(expected);
    });

    it.each([
        ['2026-01', true],
        ['2026-12', true],
        ['2026-13', false],
        ['2026-00', false],
        ['2026-1', false],
        ['x', false],
        [42, false]
    ])('isMonthKey(%j) is %s', (key, expected) => {
        // Act, Assert
        expect(isMonthKey(key)).toBe(expected);
    });
});

describe('buildYear months', () => {
    it('describes all twelve months of the year', () => {
        // Act
        const { months } = build({ closedMonths: ['2026-02'], balances: { '2026-03': { a: 1 } }, settings: makeSettings({ assets: [['a', 'CAD']] }) });

        // Assert
        expect(months.map(m => m.key)).toEqual([
            '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
            '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12'
        ]);
        expect(months[1].closed).toBe(true);
        expect(months[0].closed).toBe(false);
        expect(months[2].hasBalances).toBe(true);
        expect(months[3].hasBalances).toBe(false);
    });

    it('ignores balance entries for unknown assets', () => {
        // Act
        const { months } = build({ balances: { '2026-03': { ghost: 1 } } });

        // Assert
        expect(months[2].hasBalances).toBe(false);
    });

    it('offers Copy prev. on the first empty month whose previous month has balances', () => {
        // Arrange
        const balances = { '2026-01': { a: 1 }, '2026-02': { a: 1 }, '2026-05': { a: 1 } };

        // Act
        const { months } = build({ balances, settings: makeSettings({ assets: [['a', 'CAD']] }) });

        // Assert
        expect(months.filter(m => m.canCopyPrevious).map(m => m.key)).toEqual(['2026-03']);
    });

    it('offers Copy prev. on January when the previous December has balances', () => {
        // Act
        const { months } = build({ balances: { '2025-12': { a: 1 } }, settings: makeSettings({ assets: [['a', 'CAD']] }) });

        // Assert
        expect(months[0].canCopyPrevious).toBe(true);
    });

    it('does not offer Copy prev. when the previous month only has archived assets', () => {
        // Act
        const { months } = build({ balances: { '2026-08': { old: 1 } }, settings: makeSettings({ assets: [['old', 'CAD', true]] }) });

        // Assert
        expect(months.some(m => m.canCopyPrevious)).toBe(false);
    });

    it('never offers Copy prev. after the current month', () => {
        // Arrange
        const balances = Object.fromEntries(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10'].map(m => [`2026-${m}`, { a: 1 }]));

        // Act
        const { months } = build({ balances, settings: makeSettings({ assets: [['a', 'CAD']] }) });

        // Assert
        expect(months.some(m => m.canCopyPrevious)).toBe(false);
    });

    it('offers nothing when there are no balances at all', () => {
        // Act, Assert
        expect(build().months.some(m => m.canCopyPrevious)).toBe(false);
    });
});

describe('buildYear asset rows', () => {
    it('shows native values and their CAD equivalents', () => {
        // Arrange
        const settings = makeSettings({ assets: [['usd', 'USD'], ['cad', 'CAD']], rates: { USD: 1.5 } });

        // Act
        const { assetRows } = build({ settings, balances: { '2026-01': { usd: 100, cad: -20 } } });

        // Assert
        expect(assetRows.map(r => r.asset.id)).toEqual(['usd', 'cad']);
        expect(assetRows[0].values[0]).toBe(100);
        expect(assetRows[0].cad[0]).toBe(150);
        expect(assetRows[1].cad[0]).toBe(-20);
        expect(assetRows[0].values[1]).toBeNull();
        expect(assetRows[0].cad[1]).toBeNull();
    });

    it('leaves the CAD value empty when the rate is missing', () => {
        // Act
        const { assetRows } = build({ settings: makeSettings({ assets: [['brl', 'BRL']] }), balances: { '2026-01': { brl: 10 } } });

        // Assert
        expect(assetRows[0].values[0]).toBe(10);
        expect(assetRows[0].cad[0]).toBeNull();
    });

    it('shows an archived asset only in years it had a balance', () => {
        // Arrange
        const settings = makeSettings({ assets: [['old', 'CAD', true], ['new', 'CAD']] });
        const balances = { '2025-06': { old: 5 } };

        // Act
        const previousYear = build({ year: 2025, settings, balances });
        const currentYear = build({ year: 2026, settings, balances });

        // Assert
        expect(previousYear.assetRows.map(r => r.asset.id)).toEqual(['old']);
        expect(currentYear.assetRows.map(r => r.asset.id)).toEqual(['new']);
    });

    it('shows active assets in the current and future years only', () => {
        // Arrange
        const settings = makeSettings({ assets: [['a', 'CAD']] });

        // Act, Assert
        expect(build({ year: 2027, settings }).assetRows).toHaveLength(1);
        expect(build({ year: 2025, settings }).assetRows).toHaveLength(0);
    });
});

describe('buildYear net worth', () => {
    it('sums CAD values for months with balances and leaves others empty', () => {
        // Arrange
        const settings = makeSettings({ assets: [['usd', 'USD'], ['brl', 'BRL'], ['cad', 'CAD']], rates: { USD: 1.5, BRL: 0.25 } });
        const balances = { '2026-01': { usd: 100, brl: 40, cad: 10 }, '2026-02': { cad: -5 } };

        // Act
        const { netWorth, missingRates } = build({ settings, balances });

        // Assert
        expect(netWorth[0]).toBe(170);
        expect(netWorth[1]).toBe(-5);
        expect(netWorth[2]).toBeNull();
        expect(missingRates).toEqual([]);
    });

    it('reports a currency used without a rate and leaves those months empty', () => {
        // Arrange
        const settings = makeSettings({ assets: [['usd', 'USD'], ['cad', 'CAD']] });

        // Act
        const { netWorth, missingRates } = build({ settings, balances: { '2026-01': { usd: 1 }, '2026-02': { cad: 2 } } });

        // Assert
        expect(netWorth[0]).toBeNull();
        expect(netWorth[1]).toBe(2);
        expect(missingRates).toEqual(['USD']);
    });
});

describe('buildYear flow rows', () => {
    const transactions = [
        tx(2026, 1, 5, 1000, 'income', 'Trabalho'),
        tx(2026, 1, 6, 100, 'expense', 'Casa'),
        tx(2026, 1, 31, 50, 'expense', 'Mercado'),
        tx(2026, 2, 1, 200, 'expense', 'Casa'),
        tx(2026, 2, 2, 7, 'expense', UNCATEGORIZED),
        tx(2026, 2, 3, 500, 'income', 'Trabalho'),
        tx(2026, 11, 1, 999, 'expense', 'Casa'),
        tx(2025, 3, 1, 100, 'expense', 'Casa'),
        tx(2025, 4, 1, 300, 'expense', 'Casa')
    ];

    it('totals income per month up to the current month', () => {
        // Act
        const { income } = build({ transactions });

        // Assert
        expect(income.values.slice(0, 3)).toEqual([1000, 500, 0]);
        expect(income.values[9]).toBe(0);
        expect(income.values[10]).toBeNull();
        expect(income.total).toBe(1500);
    });

    it('has one expense row per Settings expense category, in Settings order', () => {
        // Act
        const { expenses } = build({ transactions });

        // Assert
        expect(expenses.map(r => r.category)).toEqual(['Casa', 'Mercado', UNCATEGORIZED]);
        expect(expenses[0].values.slice(0, 2)).toEqual([100, 200]);
        expect(expenses[1].values[0]).toBe(50);
        expect(expenses[2].values[1]).toBe(7);
    });

    it('excludes months after the current one', () => {
        // Act
        const { expenses, totalExpenses } = build({ transactions });

        // Assert
        expect(expenses[0].values[10]).toBeNull();
        expect(expenses[0].total).toBe(300);
        expect(totalExpenses.total).toBe(357);
    });

    it('computes total expenses and net income per month', () => {
        // Act
        const { totalExpenses, netIncome } = build({ transactions });

        // Assert
        expect(totalExpenses.values.slice(0, 2)).toEqual([150, 207]);
        expect(netIncome.values.slice(0, 2)).toEqual([850, 293]);
        expect(netIncome.total).toBe(1143);
    });

    it('counts expenses filed under a category missing from Settings in the total', () => {
        // Act
        const { expenses, totalExpenses } = build({ transactions: [tx(2026, 1, 1, 10, 'expense', 'Legacy')] });

        // Assert
        expect(expenses.every(r => r.values[0] === 0)).toBe(true);
        expect(totalExpenses.values[0]).toBe(10);
    });

    it('averages only closed months and compares with the previous year', () => {
        // Act
        const { expenses, totalExpenses } = build({ transactions, closedMonths: ['2026-01', '2026-02', '2025-03', '2025-04'] });

        // Assert
        expect(expenses[0].average).toBe(150);
        expect(expenses[0].prevAverage).toBe(200);
        expect(expenses[0].diffPct).toBeCloseTo(-0.25);
        expect(totalExpenses.average).toBeCloseTo(178.5);
    });

    it('leaves averages empty without closed months', () => {
        // Act
        const { income } = build({ transactions });

        // Assert
        expect(income.average).toBeNull();
        expect(income.prevAverage).toBeNull();
        expect(income.diffPct).toBeNull();
    });

    it('leaves Diff % empty when the previous average is zero', () => {
        // Act
        const { expenses } = build({ transactions, closedMonths: ['2026-01', '2025-05'] });

        // Assert
        expect(expenses[1].average).toBe(50);
        expect(expenses[1].prevAverage).toBe(0);
        expect(expenses[1].diffPct).toBeNull();
    });

    it('measures Diff % against the size of a negative previous average', () => {
        // Arrange
        const example = [tx(2025, 1, 1, 100, 'expense', 'Casa'), tx(2026, 1, 1, 100, 'income', 'Trabalho')];

        // Act
        const { netIncome } = build({ transactions: example, closedMonths: ['2025-01', '2026-01'] });

        // Assert
        expect(netIncome.prevAverage).toBe(-100);
        expect(netIncome.average).toBe(100);
        expect(netIncome.diffPct).toBeCloseTo(2);
    });

    it('matches the E10 example: expenses 100 and 200 against a previous average of 100', () => {
        // Arrange
        const example = [tx(2026, 1, 1, 100, 'expense', 'Casa'), tx(2026, 2, 1, 200, 'expense', 'Casa'), tx(2025, 1, 1, 100, 'expense', 'Casa')];

        // Act
        const { totalExpenses } = build({ transactions: example, closedMonths: ['2026-01', '2026-02', '2025-01'] });

        // Assert
        expect(totalExpenses.average).toBe(150);
        expect(totalExpenses.diffPct).toBeCloseTo(0.5);
    });
});

describe('buildYear indicators', () => {
    const settings = makeSettings({ assets: [['a', 'CAD']] });

    it('matches the E14 example', () => {
        // Arrange
        const balances = { '2025-11': { a: 900 }, '2025-12': { a: 1000 }, '2026-03': { a: 1100 }, '2026-04': { a: 1200 } };
        const transactions = [tx(2026, 1, 1, 500, 'income', 'Trabalho'), tx(2026, 2, 1, 200, 'expense', 'Casa')];

        // Act
        const { indicators } = build({ settings, balances, transactions });

        // Assert
        expect(indicators).toEqual({
            startMonth: '2025-12',
            startNetWorth: 1000,
            currentMonth: '2026-04',
            currentNetWorth: 1200,
            change: 200,
            changePct: 0.2,
            totalIncome: 500,
            totalExpenses: 200,
            saved: 300,
            returns: -100,
            savingRate: 0.6,
            expenseChangePct: null
        });
    });

    it('measures returns over the same months as the net worth change', () => {
        // Arrange
        const balances = { '2025-12': { a: 1000 }, '2026-09': { a: 1300 } };
        const transactions = [
            tx(2026, 3, 1, 300, 'income', 'Trabalho'),
            tx(2026, 10, 2, 500, 'income', 'Trabalho')
        ];

        // Act
        const { indicators } = build({ settings, balances, transactions });

        // Assert
        expect(indicators.saved).toBe(800);
        expect(indicators.returns).toBe(0);
    });

    it('leaves net worth indicators empty without balances', () => {
        // Act
        const { indicators } = build({ settings });

        // Assert
        expect(indicators.startMonth).toBeNull();
        expect(indicators.startNetWorth).toBeNull();
        expect(indicators.currentNetWorth).toBeNull();
        expect(indicators.change).toBeNull();
        expect(indicators.changePct).toBeNull();
        expect(indicators.returns).toBeNull();
        expect(indicators.savingRate).toBeNull();
    });

    it('leaves the change percentage empty when the start is zero', () => {
        // Act
        const { indicators } = build({ settings, balances: { '2025-12': { a: 0 }, '2026-01': { a: 10 } } });

        // Assert
        expect(indicators.change).toBe(10);
        expect(indicators.changePct).toBeNull();
    });
});

describe('setBalance', () => {
    it.each([
        ['1234.5', 1234.5],
        [' -20 ', -20],
        ['1,234.56', 1234.56],
        ['-1,234,567', -1234567],
        ['.5', 0.5],
        ['0', 0]
    ])('stores %j as %d', (raw, expected) => {
        // Arrange
        const balances = {};

        // Act
        const result = setBalance(balances, '2026-09', 'a', raw);

        // Assert
        expect(result).toEqual({ ok: true });
        expect(balances).toEqual({ '2026-09': { a: expected } });
    });

    it('clears a value on blank input and drops the empty month', () => {
        // Arrange
        const balances = { '2026-09': { a: 1 } };

        // Act
        const result = setBalance(balances, '2026-09', 'a', '  ');

        // Assert
        expect(result).toEqual({ ok: true });
        expect(balances).toEqual({});
    });

    it('keeps the month while other assets still have values', () => {
        // Arrange
        const balances = { '2026-09': { a: 1, b: 2 } };

        // Act
        setBalance(balances, '2026-09', 'a', '');

        // Assert
        expect(balances).toEqual({ '2026-09': { b: 2 } });
    });

    it.each(['abc', '1.2.3', 'Infinity', '--1', '1e400', '1234,56', '9.876,54', '0x10', '1,23', '1e3', '-', '.', '-.'])('rejects %j and keeps the old value', raw => {
        // Arrange
        const balances = { '2026-09': { a: 1 } };

        // Act
        const result = setBalance(balances, '2026-09', 'a', raw);

        // Assert
        expect(result).toEqual({ ok: false, error: 'Enter a number, or leave it blank to clear.' });
        expect(balances).toEqual({ '2026-09': { a: 1 } });
    });

    it('rejects an invalid month key', () => {
        // Act, Assert
        expect(setBalance({}, '2026-13', 'a', '1')).toEqual({ ok: false, error: 'Invalid month "2026-13".' });
    });
});

describe('copyPreviousMonth', () => {
    it('copies the previous month for active assets only', () => {
        // Arrange
        const settings = makeSettings({ assets: [['a', 'CAD'], ['b', 'USD'], ['old', 'CAD', true]] });
        const balances = { '2026-08': { a: 1, b: 2, old: 3 } };

        // Act
        const result = copyPreviousMonth(balances, '2026-09', settings);

        // Assert
        expect(result).toEqual({ ok: true, copied: 2 });
        expect(balances['2026-09']).toEqual({ a: 1, b: 2 });
    });

    it('does not overwrite values already entered', () => {
        // Arrange
        const settings = makeSettings({ assets: [['a', 'CAD'], ['b', 'CAD']] });
        const balances = { '2026-08': { a: 1, b: 2 }, '2026-09': { a: 9 } };

        // Act
        const result = copyPreviousMonth(balances, '2026-09', settings);

        // Assert
        expect(result.copied).toBe(1);
        expect(balances['2026-09']).toEqual({ a: 9, b: 2 });
    });

    it('crosses the year boundary', () => {
        // Arrange
        const settings = makeSettings({ assets: [['a', 'CAD']] });
        const balances = { '2025-12': { a: 5 } };

        // Act
        copyPreviousMonth(balances, '2026-01', settings);

        // Assert
        expect(balances['2026-01']).toEqual({ a: 5 });
    });

    it('creates nothing when the previous month is empty', () => {
        // Arrange
        const balances = {};

        // Act
        const result = copyPreviousMonth(balances, '2026-09', makeSettings({ assets: [['a', 'CAD']] }));

        // Assert
        expect(result).toEqual({ ok: true, copied: 0 });
        expect(balances).toEqual({});
    });
});

describe('toggleClosed', () => {
    it('closes an open month, keeping the list sorted', () => {
        // Arrange
        const closedMonths = ['2026-03', '2026-01'];

        // Act
        const closed = toggleClosed(closedMonths, '2026-02');

        // Assert
        expect(closed).toBe(true);
        expect(closedMonths).toEqual(['2026-01', '2026-02', '2026-03']);
    });

    it('reopens a closed month', () => {
        // Arrange
        const closedMonths = ['2026-01', '2026-02'];

        // Act
        const closed = toggleClosed(closedMonths, '2026-01');

        // Assert
        expect(closed).toBe(false);
        expect(closedMonths).toEqual(['2026-02']);
    });
});

describe('availableYears', () => {
    it('lists years with balances or transactions plus the current year, newest first', () => {
        // Act
        const years = availableYears({
            transactions: [tx(2024, 5, 1, 1, 'expense', 'Casa')],
            balances: { '2025-01': { a: 1 } },
            today: TODAY
        });

        // Assert
        expect(years).toEqual([2026, 2025, 2024]);
    });

    it('lists only the current year when there is no data', () => {
        // Act, Assert
        expect(availableYears({ transactions: [], balances: {}, today: TODAY })).toEqual([2026]);
    });
});
