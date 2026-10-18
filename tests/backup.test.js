import { describe, it, expect } from 'vitest';
import { buildBackup, validateBackup, describeBackup, backupFileName } from '../js/backup.js';
import { emptySettings, migrateSettings } from '../js/settings.js';

const NO_DETAILS = { type: null, institution: '', owner: '', holding: '' };

function validState() {
    const settings = emptySettings();
    settings.rates = { USD: 1.4, BRL: 0.28, date: '2026-10-09', refreshedAt: '2026-10-10T00:00:00.000Z' };
    settings.categories.expense.unshift('Casa');
    settings.categories.income.unshift('Trabalho');
    settings.assets.push({ id: 'a1', name: 'Savings', currency: 'CAD', archived: false, ...NO_DETAILS });
    settings.assets.push({ id: 'a2', name: 'TFSA Broker - Sam - ETF1', currency: 'USD', archived: true, type: 'TFSA', institution: 'Broker', owner: 'Sam', holding: 'ETF1' });
    settings.holdings.push({ name: 'ETF1', split: { usEquity: 60, intlEquity: 40 } });
    settings.targets = { usEquity: 70, cash: 30, fixedIncome: 0 };
    Object.assign(settings.fire, { swr: 3.5, retirementSpending: 40000, birthYear: 1990, projectionStart: 2017, projectionEnd: 2037 });

    return {
        settings,
        transactions: [
            { date: new Date(2026, 8, 1), description: 'Rent', amount: 1500, type: 'expense', category: 'Casa', account: 'TD' },
            { date: new Date(2026, 8, 2), description: 'Pay', amount: 4000, type: 'income', category: 'Trabalho', account: 'TD' }
        ],
        balances: { '2026-08': { a1: 100, a2: -5.5 }, '2026-09': { a1: 120 } },
        closedMonths: ['2026-08'],
        registeredRoom: [{ year: 2026, account: 'TFSA', person: 'Sam', room: 7000, contributed: null }]
    };
}

// A backup as the previous version wrote it: no asset details, holdings, targets, FIRE inputs or room.
function versionOneFile() {
    const state = validState();
    const settings = {
        version: 1,
        rates: state.settings.rates,
        categories: state.settings.categories,
        assets: [{ id: 'a1', name: 'Savings', currency: 'CAD', archived: false }, { id: 'a2', name: 'Brokerage', currency: 'USD', archived: true }]
    };

    return asFile({ app: 'fintracker', version: 1, exportedAt: NOW.toISOString(), settings, transactions: state.transactions, balances: state.balances, closedMonths: state.closedMonths });
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
        expect(backup.version).toBe(2);
        expect(backup.exportedAt).toBe('2026-10-11T12:00:00.000Z');
        expect(backup.settings).toEqual(state.settings);
        expect(backup.balances).toEqual(state.balances);
        expect(backup.closedMonths).toEqual(state.closedMonths);
        expect(backup.registeredRoom).toEqual(state.registeredRoom);
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
        expect(result.data.registeredRoom).toEqual(state.registeredRoom);
    });

    it('restores a version 1 backup with the new settings at their defaults and no room', () => {
        // Arrange
        const file = versionOneFile();

        // Act
        const result = validateBackup(file);

        // Assert
        expect(result.ok).toBe(true);
        expect(result.data.settings).toEqual(migrateSettings(file.settings));
        expect(result.data.settings.version).toBe(2);
        expect(result.data.registeredRoom).toEqual([]);
    });

    it('carries an earlier fixed spending amount over as the retirement spending override', () => {
        // Arrange
        const file = asFile(buildBackup(validState(), NOW));
        delete file.settings.fire.retirementSpending;
        Object.assign(file.settings.fire, { spendingMode: 'fixed', fixedSpending: 55000 });

        // Act
        const result = validateBackup(file);

        // Assert
        expect(result.ok).toBe(true);
        expect(result.data.settings.fire).toEqual({ ...validState().settings.fire, retirementSpending: 55000 });
    });

    it('rejects a version 1 backup with version 2 settings', () => {
        // Arrange
        const file = versionOneFile();
        file.settings.version = 2;

        // Act, Assert
        expect(validateBackup(file).errors).toContain('Unsupported settings version 2.');
    });

    it('accepts an empty fresh-install backup', () => {
        // Arrange
        const state = { settings: emptySettings(), transactions: [], balances: {}, closedMonths: [], registeredRoom: [] };

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
        const backup = { ...asFile(buildBackup(validState(), NOW)), version: 3 };

        // Act, Assert
        expect(validateBackup(backup)).toEqual({ ok: false, errors: ['Unsupported backup version 3.'] });
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
        ['a duplicate closed month', b => { b.closedMonths.push('2026-08'); }, 'Closed months: "2026-08" appears more than once.'],
        ['an older settings version', b => { b.settings.version = 1; }, 'Unsupported settings version 1.'],
        ['an unknown asset type', b => { b.settings.assets[0].type = 'Crypto'; }, 'Asset 1: unknown type "Crypto".'],
        ['a non-text institution', b => { b.settings.assets[0].institution = 5; }, 'Asset 1: institution must be text.'],
        ['a missing owner', b => { delete b.settings.assets[1].owner; }, 'Asset 2: owner must be text.'],
        ['a non-text holding', b => { b.settings.assets[1].holding = null; }, 'Asset 2: holding must be text.'],
        ['holdings not a list', b => { b.settings.holdings = {}; }, 'Holdings must be a list.'],
        ['a holding without a name', b => { b.settings.holdings[0].name = ' '; }, 'Holding 1: name is missing.'],
        ['a duplicate holding', b => { b.settings.holdings.push({ name: 'etf1', split: { cash: 100 } }); }, 'Holding 2: "etf1" appears more than once.'],
        ['a holding split over 100', b => { b.settings.holdings[0].split.cash = 20; }, 'Holding 1: The split adds up to 120%; it must be 100%.'],
        ['a holding entry that is not an object', b => { b.settings.holdings.push(3); }, 'Holding 2: must be an object.'],
        ['targets under 100', b => { b.settings.targets = { cash: 20 }; }, 'Targets: The split adds up to 20%; it must be 100%.'],
        ['missing FIRE inputs', b => { delete b.settings.fire; }, 'FIRE settings are missing.'],
        ['a zero SWR', b => { b.settings.fire.swr = 0; }, 'FIRE swr: Enter a number above 0 and up to 100.'],
        ['a missing FIRE input', b => { delete b.settings.fire.inflation; }, 'FIRE inflation: Enter a number above -100.'],
        ['an end year before the start', b => { b.settings.fire.projectionEnd = 2010; }, 'FIRE: The projection end year must be after its start year.'],
        ['room not a list', b => { b.registeredRoom = {}; }, 'Registered room must be a list.'],
        ['a bad room year', b => { b.registeredRoom[0].year = '26'; }, 'Registered room 1: year must be a whole number from 1900 to 2100.']
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
        const text = JSON.stringify(buildBackup(validState(), NOW)).replace('"version":2,"rates"', '"__proto__":{"polluted":true},"extra":1,"version":2,"rates"');
        const backup = JSON.parse(text);

        // Act
        const { data } = validateBackup(backup);

        // Assert
        expect(Object.getPrototypeOf(data.settings)).toBe(Object.prototype);
        expect(Object.keys(data.settings)).toEqual(['version', 'rates', 'categories', 'assets', 'holdings', 'targets', 'fire']);
        expect(data.settings).toEqual(validState().settings);
    });

    it('keeps only known fields inside assets, holdings, FIRE inputs and room entries', () => {
        // Arrange
        const backup = asFile(buildBackup(validState(), NOW));
        backup.settings.assets[0].extra = 1;
        backup.settings.holdings[0].extra = 1;
        backup.settings.fire.extra = 1;
        backup.registeredRoom[0].extra = 1;

        // Act
        const { data } = validateBackup(backup);

        // Assert
        expect(data.settings).toEqual(validState().settings);
        expect(data.registeredRoom).toEqual(validState().registeredRoom);
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
        expect(describeBackup(data)).toBe('2 transactions, 2 assets, 2 months of balances, 1 registered room entry. This replaces all current data.');
    });

    it('counts registered room entries when there are any', () => {
        // Arrange
        const data = { ...validState(), registeredRoom: [validState().registeredRoom[0], { ...validState().registeredRoom[0], person: 'Kim' }] };

        // Act, Assert
        expect(describeBackup(data)).toBe('2 transactions, 2 assets, 2 months of balances, 2 registered room entries. This replaces all current data.');
        expect(describeBackup({ ...data, registeredRoom: data.registeredRoom.slice(1) })).toContain(', 1 registered room entry.');
    });

    it('uses singular wording and thousands separators', () => {
        // Arrange
        const data = { ...validState(), balances: { '2026-08': {} } };
        data.transactions = Array.from({ length: 1234 }, () => data.transactions[0]);
        data.settings.assets.pop();
        data.registeredRoom = [];

        // Act, Assert
        expect(describeBackup(data)).toBe('1,234 transactions, 1 asset, 1 month of balances. This replaces all current data.');
    });
});
