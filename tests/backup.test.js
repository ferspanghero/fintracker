import { describe, it, expect } from 'vitest';
import { buildBackup, validateBackup, describeBackup, backupFileName } from '../js/backup.js';
import { emptySettings } from '../js/settings.js';

function validState() {
    const settings = emptySettings();
    settings.rates = { USD: 1.4, BRL: 0.28, date: '2026-10-09', refreshedAt: '2026-10-10T00:00:00.000Z' };
    settings.categories.expense.unshift('Casa');
    settings.categories.income.unshift('Trabalho');
    settings.assets.push({ id: 'a1', name: 'Savings', currency: 'CAD', archived: false });
    settings.assets.push({ id: 'a2', name: 'Brokerage', currency: 'USD', archived: true });

    return {
        settings,
        transactions: [
            { date: new Date(2026, 8, 1), description: 'Rent', amount: 1500, type: 'expense', category: 'Casa', account: 'TD' },
            { date: new Date(2026, 8, 2), description: 'Pay', amount: 4000, type: 'income', category: 'Trabalho', account: 'TD' }
        ],
        balances: { '2026-08': { a1: 100, a2: -5.5 }, '2026-09': { a1: 120 } },
        closedMonths: ['2026-08']
    };
}

// A backup as it comes back from a downloaded file.
const asFile = backup => JSON.parse(JSON.stringify(backup));
const NOW = new Date('2026-10-11T12:00:00Z');

describe('buildBackup', () => {
    it('wraps all app data with the app name, version and export time', () => {
        // Arrange
        const state = validState();

        // Act
        const backup = asFile(buildBackup(state, NOW));

        // Assert
        expect(backup.app).toBe('fintracker');
        expect(backup.version).toBe(1);
        expect(backup.exportedAt).toBe('2026-10-11T12:00:00.000Z');
        expect(backup.settings).toEqual(state.settings);
        expect(backup.balances).toEqual(state.balances);
        expect(backup.closedMonths).toEqual(state.closedMonths);
        expect(backup.transactions[0].date).toBe(state.transactions[0].date.toISOString());
    });

    it('names the file by local date', () => {
        // Act, Assert
        expect(backupFileName(new Date(2026, 9, 1, 23, 30))).toBe('fintracker-backup-2026-10-01.json');
    });
});

describe('validateBackup', () => {
    it('accepts its own output and returns rehydrated data', () => {
        // Arrange
        const state = validState();

        // Act
        const result = validateBackup(asFile(buildBackup(state, NOW)));

        // Assert
        expect(result.ok).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.data.transactions).toEqual(state.transactions);
        expect(result.data.transactions[0].date).toBeInstanceOf(Date);
        expect(result.data.settings).toEqual(state.settings);
        expect(result.data.balances).toEqual(state.balances);
        expect(result.data.closedMonths).toEqual(state.closedMonths);
    });

    it('accepts an empty fresh-install backup', () => {
        // Arrange
        const state = { settings: emptySettings(), transactions: [], balances: {}, closedMonths: [] };

        // Act, Assert
        expect(validateBackup(asFile(buildBackup(state, NOW))).ok).toBe(true);
    });

    it('accepts negative and zero transaction amounts', () => {
        // Arrange
        const backup = asFile(buildBackup(validState(), NOW));
        backup.transactions[0].amount = -3;
        backup.transactions[1].amount = 0;

        // Act, Assert
        expect(validateBackup(backup).ok).toBe(true);
    });

    it.each([
        ['null', null, 'Not a FinTracker backup.'],
        ['an array', [], 'Not a FinTracker backup.'],
        ['another app', { app: 'other', version: 1 }, 'Not a FinTracker backup.']
    ])('rejects %s outright', (_, input, error) => {
        // Act
        const result = validateBackup(input);

        // Assert
        expect(result).toEqual({ ok: false, errors: [error] });
    });

    it('rejects an unsupported version', () => {
        // Arrange
        const backup = { ...asFile(buildBackup(validState(), NOW)), version: 2 };

        // Act, Assert
        expect(validateBackup(backup)).toEqual({ ok: false, errors: ['Unsupported backup version 2.'] });
    });

    const cases = [
        ['missing settings', b => { delete b.settings; }, 'Settings are missing.'],
        ['a negative rate', b => { b.settings.rates.USD = -1; }, 'USD rate must be a positive number or empty.'],
        ['a text rate', b => { b.settings.rates.BRL = '0.2'; }, 'BRL rate must be a positive number or empty.'],
        ['a non-text rate date', b => { b.settings.rates.date = 20261009; }, 'Rate date must be text or empty.'],
        ['a bad refresh time', b => { b.settings.rates.refreshedAt = 'soon'; }, 'Rate refresh time must be a date or empty.'],
        ['missing categories', b => { delete b.settings.categories; }, 'Expense categories must be a list.'],
        ['an empty category name', b => { b.settings.categories.expense.unshift(' '); }, 'Expense categories contain an empty name.'],
        ['a duplicate category', b => { b.settings.categories.income.unshift('trabalho'); }, 'Income categories contain "Trabalho" more than once.'],
        ['no Sem Categoria', b => { b.settings.categories.expense = ['Casa']; }, 'Expense categories must include "Sem Categoria".'],
        ['assets not a list', b => { b.settings.assets = {}; }, 'Assets must be a list.'],
        ['a duplicate asset id', b => { b.settings.assets[1].id = 'a1'; }, 'Asset 2: id "a1" is used more than once.'],
        ['a duplicate asset name', b => { b.settings.assets[1].name = 'savings'; }, 'Asset 2: name "savings" is used more than once.'],
        ['an asset without a name', b => { b.settings.assets[0].name = ''; }, 'Asset 1: name is missing.'],
        ['an asset without an id', b => { b.settings.assets[0].id = ''; }, 'Asset 1: id is missing.'],
        ['an unsupported currency', b => { b.settings.assets[0].currency = 'EUR'; }, 'Asset 1: unsupported currency "EUR".'],
        ['a non-boolean archived flag', b => { b.settings.assets[0].archived = 'no'; }, 'Asset 1: archived must be true or false.'],
        ['transactions not a list', b => { b.transactions = {}; }, 'Transactions must be a list.'],
        ['a bad date', b => { b.transactions[0].date = 'yesterday'; }, 'Transaction 1: invalid date.'],
        ['an empty description', b => { b.transactions[0].description = ''; }, 'Transaction 1: description is missing.'],
        ['a text amount', b => { b.transactions[0].amount = '10'; }, 'Transaction 1: amount must be a number.'],
        ['an unknown type', b => { b.transactions[0].type = 'transfer'; }, 'Transaction 1: type must be income or expense.'],
        ['an unknown category', b => { b.transactions[1].category = 'Bonus'; }, 'Transaction 2: category "Bonus" is not in the income categories.'],
        ['a missing account', b => { delete b.transactions[0].account; }, 'Transaction 1: account must be text.'],
        ['balances not an object', b => { b.balances = []; }, 'Balances must be an object.'],
        ['a bad month key', b => { b.balances['2026-13'] = {}; }, 'Balances: invalid month "2026-13".'],
        ['an unknown asset id', b => { b.balances['2026-09'].ghost = 1; }, 'Balances 2026-09: unknown asset "ghost".'],
        ['a text balance', b => { b.balances['2026-09'].a1 = '1'; }, 'Balances 2026-09: value for "a1" must be a number.'],
        ['a month that is not an object', b => { b.balances['2026-09'] = 5; }, 'Balances 2026-09: must be an object.'],
        ['closed months not a list', b => { b.closedMonths = '2026-01'; }, 'Closed months must be a list.'],
        ['a bad closed month', b => { b.closedMonths.push('2026-1'); }, 'Closed months: invalid month "2026-1".'],
        ['a duplicate closed month', b => { b.closedMonths.push('2026-08'); }, 'Closed months: "2026-08" appears more than once.']
    ];

    it.each(cases)('rejects %s', (_, mutate, error) => {
        // Arrange
        const backup = asFile(buildBackup(validState(), NOW));
        mutate(backup);

        // Act
        const result = validateBackup(backup);

        // Assert
        expect(result.ok).toBe(false);
        expect(result.errors).toContain(error);
        expect(result.data).toBeUndefined();
    });

    it('keeps only known settings fields', () => {
        // Arrange
        const text = JSON.stringify(buildBackup(validState(), NOW)).replace('"version":1,"rates"', '"__proto__":{"polluted":true},"extra":1,"version":1,"rates"');
        const backup = JSON.parse(text);

        // Act
        const { data } = validateBackup(backup);

        // Assert
        expect(Object.getPrototypeOf(data.settings)).toBe(Object.prototype);
        expect(Object.keys(data.settings)).toEqual(['version', 'rates', 'categories', 'assets']);
        expect(data.settings).toEqual(validState().settings);
    });

    it('collects every error at once', () => {
        // Arrange
        const backup = asFile(buildBackup(validState(), NOW));
        backup.balances['2026-09'].ghost = 1;
        backup.balances.bad = {};

        // Act
        const result = validateBackup(backup);

        // Assert
        expect(result.errors).toEqual(['Balances: invalid month "bad".', 'Balances 2026-09: unknown asset "ghost".']);
    });
});

describe('describeBackup', () => {
    it('summarizes what a restore will bring in', () => {
        // Arrange
        const data = validState();

        // Act, Assert
        expect(describeBackup(data)).toBe('2 transactions, 2 assets, 2 months of balances. This replaces all current data.');
    });

    it('uses singular wording and thousands separators', () => {
        // Arrange
        const data = { ...validState(), balances: { '2026-08': {} } };
        data.transactions = Array.from({ length: 1234 }, () => data.transactions[0]);
        data.settings.assets.pop();

        // Act, Assert
        expect(describeBackup(data)).toBe('1,234 transactions, 1 asset, 1 month of balances. This replaces all current data.');
    });
});
