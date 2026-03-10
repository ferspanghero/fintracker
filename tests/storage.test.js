import { describe, it, expect, vi } from 'vitest';

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

    it('calls saveToMonthlyFiles', () => {
        const spy = vi.spyOn(globalThis, 'saveToMonthlyFiles');
        saveData();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});

describe('saveToMonthlyFiles', () => {
    it('groups transactions by month', () => {
        transactions.push(
            { date: new Date(2025, 0, 15), description: 'Jan', amount: 10, type: 'expense', category: 'Casa', account: 'Amex' },
            { date: new Date(2025, 1, 15), description: 'Feb', amount: 20, type: 'expense', category: 'Casa', account: 'Amex' }
        );

        saveToMonthlyFiles();

        expect(localStorage.getItem('transactions_2025-01.csv')).toBeTruthy();
        expect(localStorage.getItem('transactions_2025-02.csv')).toBeTruthy();
    });

    it('groups same-month transactions together', () => {
        transactions.push(
            { date: new Date(2025, 0, 10), description: 'First', amount: 10, type: 'expense', category: 'Casa', account: 'Amex' },
            { date: new Date(2025, 0, 20), description: 'Second', amount: 20, type: 'expense', category: 'Casa', account: 'Amex' }
        );

        saveToMonthlyFiles();

        const csv = localStorage.getItem('transactions_2025-01.csv');
        expect(csv).toContain('First');
        expect(csv).toContain('Second');
    });

    it('CSV content starts with BOM and has header', () => {
        transactions.push(
            { date: new Date(2025, 0, 15), description: 'Test', amount: 10, type: 'expense', category: 'Casa', account: 'Amex' }
        );

        saveToMonthlyFiles();

        const csv = localStorage.getItem('transactions_2025-01.csv');
        expect(csv.startsWith('\uFEFF')).toBe(true);
        expect(csv).toContain('Date,Description,Category,Account,Amount,Type');
    });
});
