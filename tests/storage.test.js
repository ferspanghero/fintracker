import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadData, saveData, saveBalanceSheet, clearLegacyKeys } from '../js/storage.js';
import { transactions, settings, balances, closedMonths } from '../js/state.js';
import { emptySettings } from '../js/settings.js';

const sampleTransaction = () => ({
    date: new Date(2025, 3, 12), description: 'Test', amount: 50,
    type: 'expense', category: 'Casa', account: 'Amex'
});

// Spies are restored even when an assertion fails first.
afterEach(() => {
    vi.restoreAllMocks();
});

describe('loadData', () => {
    it('starts empty with fresh-install settings when localStorage is empty', () => {
        // Arrange
        transactions.push(sampleTransaction());
        balances['2026-01'] = { a: 1 };
        closedMonths.push('2026-01');

        // Act
        loadData();

        // Assert
        expect(transactions).toEqual([]);
        expect(balances).toEqual({});
        expect(closedMonths).toEqual([]);
        expect(settings).toEqual(emptySettings());
    });

    it('loads saved transactions and converts dates', () => {
        // Arrange
        const saved = [
            { date: '2025-04-12T00:00:00.000Z', description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }
        ];
        localStorage.setItem('transactions', JSON.stringify(saved));

        // Act
        loadData();

        // Assert
        expect(transactions.length).toBe(1);
        expect(transactions[0].date).toBeInstanceOf(Date);
        expect(transactions[0].description).toBe('Test');
    });

    it('loads settings, balances and closed months', () => {
        // Arrange
        const savedSettings = { ...emptySettings(), assets: [{ id: 'a', name: 'Savings', currency: 'CAD', archived: false }] };
        localStorage.setItem('settings', JSON.stringify(savedSettings));
        localStorage.setItem('balances', JSON.stringify({ '2026-09': { a: 12.5 } }));
        localStorage.setItem('closedMonths', JSON.stringify(['2026-09']));

        // Act
        loadData();

        // Assert
        expect(settings).toEqual(savedSettings);
        expect(balances).toEqual({ '2026-09': { a: 12.5 } });
        expect(closedMonths).toEqual(['2026-09']);
    });

    it('fills settings sections missing from storage with fresh-install defaults', () => {
        // Arrange
        localStorage.setItem('settings', JSON.stringify({ version: 1, assets: [] }));

        // Act
        loadData();

        // Assert
        expect(settings).toEqual(emptySettings());
    });

    it('ignores the legacy categories key', () => {
        // Arrange
        localStorage.setItem('categories', JSON.stringify({ expense: ['Custom1'], income: ['Custom2'] }));

        // Act
        loadData();

        // Assert
        expect(settings.categories).toEqual(emptySettings().categories);
    });

    it('does not write to localStorage', () => {
        // Arrange
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        // Act
        loadData();

        // Assert
        expect(setItem).not.toHaveBeenCalled();
    });
});

describe('saveData', () => {
    it('saves all four keys', () => {
        // Arrange
        transactions.push(sampleTransaction());
        balances['2026-09'] = { a: 3 };
        closedMonths.push('2026-09');

        // Act
        saveData();

        // Assert
        const saved = JSON.parse(localStorage.getItem('transactions'));
        expect(saved.length).toBe(1);
        expect(saved[0].description).toBe('Test');
        expect(saved[0].amount).toBe(50);
        expect(JSON.parse(localStorage.getItem('settings'))).toEqual(settings);
        expect(JSON.parse(localStorage.getItem('balances'))).toEqual({ '2026-09': { a: 3 } });
        expect(JSON.parse(localStorage.getItem('closedMonths'))).toEqual(['2026-09']);
    });

    it('reports success', () => {
        // Act, Assert
        expect(saveData()).toBe(true);
    });

    it('leaves the legacy categories key alone', () => {
        // Arrange
        localStorage.setItem('categories', '{"expense":[],"income":[]}');

        // Act
        saveData();

        // Assert
        expect(localStorage.getItem('categories')).toBe('{"expense":[],"income":[]}');
    });

    it('round-trips through loadData', () => {
        // Arrange
        transactions.push(sampleTransaction());
        settings.rates.USD = 1.4;
        saveData();
        const expected = { transactions: structuredClone(transactions), settings: structuredClone(settings) };
        transactions.length = 0;
        settings.rates.USD = null;

        // Act
        loadData();

        // Assert
        expect(transactions).toEqual(expected.transactions);
        expect(settings).toEqual(expected.settings);
    });

    it('does not crash when localStorage is full and alerts the user', () => {
        // Arrange
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('QuotaExceededError');
        });
        transactions.push(sampleTransaction());

        // Act, Assert
        expect(saveData()).toBe(false);
        expect(alertSpy).toHaveBeenCalledWith('Could not save data. LocalStorage may be full or disabled.');
    });
});

describe('saveBalanceSheet', () => {
    it('saves balances and closed months without rewriting transactions or settings', () => {
        // Arrange
        transactions.push(sampleTransaction());
        balances['2026-09'] = { a: 3 };
        closedMonths.push('2026-09');
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        // Act
        const saved = saveBalanceSheet();

        // Assert
        expect(saved).toBe(true);
        expect(setItem.mock.calls.map(([key]) => key)).toEqual(['balances', 'closedMonths']);
        expect(JSON.parse(localStorage.getItem('balances'))).toEqual({ '2026-09': { a: 3 } });
        expect(JSON.parse(localStorage.getItem('closedMonths'))).toEqual(['2026-09']);
    });

    it('alerts and reports failure when storage refuses the write', () => {
        // Arrange
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('QuotaExceededError');
        });

        // Act
        const saved = saveBalanceSheet();

        // Assert
        expect(saved).toBe(false);
        expect(alertSpy).toHaveBeenCalledWith('Could not save data. LocalStorage may be full or disabled.');
    });
});

describe('clearLegacyKeys', () => {
    it('removes the legacy categories key', () => {
        // Arrange
        localStorage.setItem('categories', '{}');

        // Act
        clearLegacyKeys();

        // Assert
        expect(localStorage.getItem('categories')).toBeNull();
    });
});
