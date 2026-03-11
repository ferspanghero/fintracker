import { describe, it, expect, vi } from 'vitest';
import { loadData, saveData } from '../js/storage.js';
import { transactions } from '../js/state.js';
import { categories, defaultCategories } from '../js/categories.js';

describe('loadData', () => {
    it('does nothing when localStorage is empty', () => {
        loadData();
        expect(transactions).toEqual([]);
    });

    it('loads saved transactions and converts dates', () => {
        const saved = [
            { date: '2025-04-12T00:00:00.000Z', description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }
        ];
        localStorage.setItem('transactions', JSON.stringify(saved));

        loadData();

        expect(transactions.length).toBe(1);
        expect(transactions[0].date).toBeInstanceOf(Date);
        expect(transactions[0].description).toBe('Test');
    });

    it('loads saved categories', () => {
        const customCategories = { expense: ['Custom1'], income: ['Custom2'] };
        localStorage.setItem('categories', JSON.stringify(customCategories));

        loadData();

        expect(categories).toEqual(customCategories);
    });

    it('preserves default categories when none saved', () => {
        loadData();
        expect(categories).toEqual(defaultCategories);
    });
});

describe('saveData', () => {
    it('saves transactions to localStorage', () => {
        transactions.push({
            date: new Date(2025, 3, 12),
            description: 'Test',
            amount: 50,
            type: 'expense',
            category: 'Casa',
            account: 'Amex'
        });

        saveData();

        const saved = JSON.parse(localStorage.getItem('transactions'));
        expect(saved.length).toBe(1);
        expect(saved[0].description).toBe('Test');
        expect(saved[0].amount).toBe(50);
    });

    it('saves categories to localStorage', () => {
        categories.expense.push('NewCategory');

        saveData();

        const saved = JSON.parse(localStorage.getItem('categories'));
        expect(saved.expense).toContain('NewCategory');
    });

    it('does not crash when localStorage is full and alerts the user', () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('QuotaExceededError');
        });

        transactions.push({
            date: new Date(2025, 3, 12), description: 'Test', amount: 50,
            type: 'expense', category: 'Casa', account: 'Amex'
        });

        expect(() => saveData()).not.toThrow();
        expect(alertSpy).toHaveBeenCalledWith('Could not save data. LocalStorage may be full or disabled.');
        vi.restoreAllMocks();
    });

    it('does not save monthly files to localStorage', () => {
        transactions.push({
            date: new Date(2025, 0, 15), description: 'Test', amount: 10, type: 'expense', category: 'Casa', account: 'Amex'
        });
        saveData();
        expect(localStorage.getItem('transactions_2025-01.csv')).toBeNull();
    });
});

