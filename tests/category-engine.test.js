import { describe, it, expect, beforeAll } from 'vitest';
import {
    loadCategoryKeywords,
    categorizeTransaction,
    defaultCategories,
    UNCATEGORIZED
} from '../js/category-engine.js';

describe('defaultCategories', () => {
    it('exposes expense and income arrays with core entries', () => {
        expect(Array.isArray(defaultCategories.expense)).toBe(true);
        expect(Array.isArray(defaultCategories.income)).toBe(true);
        expect(defaultCategories.expense).toContain('Casa');
        expect(defaultCategories.expense).toContain(UNCATEGORIZED);
        expect(defaultCategories.income).toContain('Trabalho');
        expect(defaultCategories.income).toContain(UNCATEGORIZED);
    });
});

describe('loadCategoryKeywords', () => {
    it('returns only generic keywords when no path is supplied', async () => {
        const kw = await loadCategoryKeywords();
        expect(kw.expense.Mercado).toContain('costco');
        expect(kw.income.Trabalho).toContain('payroll');
        expect(kw.expense.Casa).not.toContain('zzsentinelcasazz');
    });

    it('falls back to generic keywords when path points to a nonexistent file', async () => {
        const kw = await loadCategoryKeywords('./definitely-not-present-xyz.js');
        expect(kw.expense.Mercado).toContain('costco');
        expect(kw.expense.Casa).not.toContain('zzsentinelcasazz');
    });

    it('falls back to generic keywords when target module lacks a personalKeywords export', async () => {
        const kw = await loadCategoryKeywords('../tests/fixtures/empty-personal-keywords.js');
        expect(kw.expense.Mercado).toContain('costco');
        expect(kw.expense.Casa).not.toContain('zzsentinelcasazz');
    });

    it('loads and prepends personal overrides when path points to a real file', async () => {
        const kw = await loadCategoryKeywords('../tests/fixtures/test-personal-keywords.js');
        expect(kw.expense.Casa[0]).toBe('zzsentinelcasazz');
        expect(kw.expense.Mercado[0]).toBe('zzsentinelmercadozz');
        expect(kw.income.Trabalho[0]).toBe('zzsentineltrabalhozz');
        // Generics still follow personal entries.
        expect(kw.expense.Mercado).toContain('costco');
    });

    it('every category in the merged map is a known default category', async () => {
        const kw = await loadCategoryKeywords();
        Object.keys(kw.expense).forEach(key => {
            expect(defaultCategories.expense).toContain(key);
        });
        Object.keys(kw.income).forEach(key => {
            expect(defaultCategories.income).toContain(key);
        });
    });
});

describe('categorizeTransaction', () => {
    let kw;

    beforeAll(async () => {
        kw = await loadCategoryKeywords();
    });

    it('matches expense keyword via substring', () => {
        expect(categorizeTransaction('COSTCO WHOLESALE', 'expense', kw)).toBe('Mercado');
    });

    it('matches income keyword', () => {
        expect(categorizeTransaction('PAYROLL DEPOSIT', 'income', kw)).toBe('Trabalho');
    });

    it('returns Sem Categoria for unknown description', () => {
        expect(categorizeTransaction('xyzzy123unknown', 'expense', kw)).toBe(UNCATEGORIZED);
        expect(categorizeTransaction('xyzzy123unknown', 'income', kw)).toBe(UNCATEGORIZED);
    });

    it('is case insensitive', () => {
        expect(categorizeTransaction('NETFLIX', 'expense', kw)).toBe('Lazer');
        expect(categorizeTransaction('netflix', 'expense', kw)).toBe('Lazer');
    });

    it('falls back to Reembolso for income matching expense keywords', () => {
        // "costco" matches Mercado expense keyword but no income keyword
        expect(categorizeTransaction('COSTCO WHOLESALE', 'income', kw)).toBe('Reembolso');
    });

    it('returns Sem Categoria for invalid type instead of crashing', () => {
        expect(categorizeTransaction('anything', 'badtype', kw)).toBe(UNCATEGORIZED);
    });

    it('returns Sem Categoria when keywords argument is missing', () => {
        expect(categorizeTransaction('anything', 'expense')).toBe(UNCATEGORIZED);
    });

    it('personal overrides win under first-match-wins', async () => {
        const merged = await loadCategoryKeywords('../tests/fixtures/test-personal-keywords.js');
        expect(categorizeTransaction('zzsentinelcasazz payment', 'expense', merged)).toBe('Casa');
    });

    it('routes the abbreviated "amzn" descriptor to Outro', () => {
        expect(categorizeTransaction('AMZN MKTP CA', 'expense', kw)).toBe('Outro');
    });

    it('treats an amzn refund as Reembolso via the income fallback', () => {
        expect(categorizeTransaction('AMZN MKTP CA', 'income', kw)).toBe('Reembolso');
    });

    it('matches steakhouse, bagel, and wine descriptions as Alimentação', () => {
        expect(categorizeTransaction('THE STEAKHOUSE', 'expense', kw)).toBe('Alimentação');
        expect(categorizeTransaction('BAGEL SHOP', 'expense', kw)).toBe('Alimentação');
        expect(categorizeTransaction('WINE SHOP', 'expense', kw)).toBe('Alimentação');
    });

    it('does not route "online" descriptions to Internet', () => {
        expect(categorizeTransaction('ONLINE PURCHASE', 'expense', kw)).not.toBe('Internet');
    });

    it('routes "sephora" to Saúde rather than matching the "pho" substring', () => {
        expect(categorizeTransaction('SEPHORA', 'expense', kw)).toBe('Saúde');
    });

    it('routes the abbreviated "sdm" drugstore descriptor to Saúde', () => {
        expect(categorizeTransaction('SDM 2245             VANCOUVER', 'expense', kw)).toBe('Saúde');
    });

    it('routes the "haggen" supermarket descriptor to Mercado', () => {
        expect(categorizeTransaction('HAGGEN 3493', 'expense', kw)).toBe('Mercado');
    });

    it('still routes a "holiday inn" descriptor to Viagem', () => {
        expect(categorizeTransaction('HOLIDAY INN VANCOUVER', 'expense', kw)).toBe('Viagem');
    });

    it('leaves a generic "holidays" descriptor uncategorized for personal keywords to claim', () => {
        expect(categorizeTransaction('SEASONAL HOLIDAYS SHOP', 'expense', kw)).toBe(UNCATEGORIZED);
    });
});

describe('categorizeTransaction with personal overrides that outrank generics', () => {
    let merged;

    beforeAll(async () => {
        merged = await loadCategoryKeywords('../tests/fixtures/routing-personal-keywords.js');
    });

    it('lets a personal Mercado entry win over the generic "food" keyword', () => {
        expect(categorizeTransaction('ZZSENTINELFOODZZ STORE', 'expense', merged)).toBe('Mercado');
    });

    it('lets a personal Alimentação entry claim a "holidays" descriptor', () => {
        expect(categorizeTransaction('SQ *ZZSENTINELHOLIDAYSZZ', 'expense', merged)).toBe('Alimentação');
    });

    it('routes an amazon deposit to Reembolso rather than Trabalho', () => {
        expect(categorizeTransaction('AMAZON.CA               866-216-1072', 'income', merged)).toBe('Reembolso');
    });
});
