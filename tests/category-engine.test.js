import { describe, it, expect } from 'vitest';
import { categoryKeywords, defaultCategories, categorizeTransaction, UNCATEGORIZED } from '../js/category-engine.js';

describe('category-engine exports', () => {
    it('exports categoryKeywords with expense and income keys', () => {
        expect(categoryKeywords).toHaveProperty('expense');
        expect(categoryKeywords).toHaveProperty('income');
    });

    it('exports defaultCategories with expense and income arrays', () => {
        expect(Array.isArray(defaultCategories.expense)).toBe(true);
        expect(Array.isArray(defaultCategories.income)).toBe(true);
        expect(defaultCategories.expense).toContain('Casa');
        expect(defaultCategories.expense).toContain(UNCATEGORIZED);
        expect(defaultCategories.income).toContain('Trabalho');
        expect(defaultCategories.income).toContain(UNCATEGORIZED);
    });

    it('all keyword categories exist in defaultCategories', () => {
        Object.keys(categoryKeywords.expense).forEach(key => {
            expect(defaultCategories.expense).toContain(key);
        });
        Object.keys(categoryKeywords.income).forEach(key => {
            expect(defaultCategories.income).toContain(key);
        });
    });
});

describe('categorizeTransaction (from category-engine)', () => {
    it('matches expense keyword via substring', () => {
        expect(categorizeTransaction('COSTCO WHOLESALE', 'expense')).toBe('Mercado');
    });

    it('matches income keyword', () => {
        expect(categorizeTransaction('PAYROLL DEPOSIT', 'income')).toBe('Trabalho');
    });

    it('returns Sem Categoria for unknown description', () => {
        expect(categorizeTransaction('xyzzy123unknown', 'expense')).toBe(UNCATEGORIZED);
        expect(categorizeTransaction('xyzzy123unknown', 'income')).toBe(UNCATEGORIZED);
    });

    it('is case insensitive', () => {
        expect(categorizeTransaction('NETFLIX', 'expense')).toBe('Lazer');
        expect(categorizeTransaction('netflix', 'expense')).toBe('Lazer');
    });

    it('falls back to Reembolso for income matching expense keywords', () => {
        // "costco" matches Mercado expense keyword but no income keyword
        expect(categorizeTransaction('COSTCO WHOLESALE', 'income')).toBe('Reembolso');
    });

    it('returns Sem Categoria for invalid type instead of crashing', () => {
        expect(categorizeTransaction('anything', 'badtype')).toBe(UNCATEGORIZED);
    });
});
