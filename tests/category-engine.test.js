import { describe, it, expect, vi } from 'vitest';
import {
    loadCategoryKeywords,
    categorizeTransaction,
    restrictKeywords,
    UNCATEGORIZED
} from '../js/category-engine.js';

describe('restrictKeywords', () => {
    const catalog = {
        expense: { Viagem: ['hotel'], Casa: ['home'], Mercado: ['costco'] },
        income: { Trabalho: ['payroll'], Reembolso: ['refund'] }
    };

    it('keeps only allowed categories, in catalog order', () => {
        // Arrange
        const allowed = { expense: ['Mercado', 'Viagem', UNCATEGORIZED], income: ['Trabalho'] };

        // Act
        const restricted = restrictKeywords(catalog, allowed);

        // Assert
        expect(restricted).toEqual({
            expense: { Viagem: ['hotel'], Mercado: ['costco'] },
            income: { Trabalho: ['payroll'] }
        });
        expect(Object.keys(restricted.expense)).toEqual(['Viagem', 'Mercado']);
    });

    it('returns empty maps when nothing is allowed', () => {
        // Act
        const restricted = restrictKeywords(catalog, { expense: [UNCATEGORIZED], income: [UNCATEGORIZED] });

        // Assert
        expect(restricted).toEqual({ expense: {}, income: {} });
    });

    it('lets a description fall through to the next allowed category', () => {
        // Arrange
        const restricted = restrictKeywords(
            { expense: { Viagem: ['costco travel'], Mercado: ['costco'] }, income: {} },
            { expense: ['Mercado'], income: [] }
        );

        // Act, Assert
        expect(categorizeTransaction('COSTCO TRAVEL', 'expense', restricted)).toBe('Mercado');
    });

    it('tolerates a keyword map that has no entry for a type', () => {
        // Act, Assert
        expect(restrictKeywords({ expense: { Casa: ['home'] } }, { expense: ['Casa'], income: ['Trabalho'] }))
            .toEqual({ expense: { Casa: ['home'] }, income: {} });
    });

    it('tolerates a missing type in the allowed list', () => {
        // Act, Assert
        expect(restrictKeywords(catalog, { expense: ['Casa'] })).toEqual({ expense: { Casa: ['home'] }, income: {} });
    });
});

describe('loadCategoryKeywords', () => {
    it('returns no keywords when no path is given', async () => {
        // Act, Assert
        expect(await loadCategoryKeywords()).toEqual({ expense: {}, income: {} });
    });

    it('returns no keywords when the file is missing', async () => {
        // Act, Assert
        expect(await loadCategoryKeywords('./definitely-not-present-xyz.js')).toEqual({ expense: {}, income: {} });
    });

    it('returns no keywords when the file has no personalKeywords export', async () => {
        // Act, Assert
        expect(await loadCategoryKeywords('../tests/fixtures/empty-personal-keywords.js')).toEqual({ expense: {}, income: {} });
    });

    it('returns the file\'s keywords with categories in the order they are declared', async () => {
        // Act
        const kw = await loadCategoryKeywords('../tests/fixtures/test-personal-keywords.js');

        // Assert
        expect(kw).toEqual({
            expense: { Casa: ['zzsentinelcasazz'], Mercado: ['zzsentinelmercadozz'] },
            income: { Trabalho: ['zzsentineltrabalhozz'] }
        });
        expect(Object.keys(kw.expense)).toEqual(['Casa', 'Mercado']);
    });

    it('returns no keywords when the file is broken', async () => {
        // Arrange
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Act, Assert
        expect(await loadCategoryKeywords('../tests/fixtures/broken-keywords.js')).toEqual({ expense: {}, income: {} });
    });

    it('lowercases and trims keywords, dropping blank and non-string entries', async () => {
        // Act
        const kw = await loadCategoryKeywords('../tests/fixtures/messy-keywords.js');

        // Assert
        expect(kw.expense.Lazer).toEqual(['zzsentinellazerzz']);
    });

    it('treats a type the file leaves out as having no keywords', async () => {
        // Act
        const kw = await loadCategoryKeywords('../tests/fixtures/expense-only-keywords.js');

        // Assert
        expect(kw).toEqual({ expense: { Lazer: ['zzsentinellazerzz'] }, income: {} });
    });
});

describe('categorizeTransaction', () => {
    // Mercado is declared before Alimentação, so it wins descriptions both match.
    const kw = {
        expense: { Viagem: ['hotel'], Mercado: ['market'], Alimentação: ['food', 'cafe'], Lazer: ['netflix'] },
        income: { Trabalho: ['payroll'], Reembolso: ['refund'] }
    };

    it('matches an expense keyword anywhere in the description', () => {
        // Act, Assert
        expect(categorizeTransaction('SENTINEL HOTEL DOWNTOWN', 'expense', kw)).toBe('Viagem');
    });

    it('matches an income keyword', () => {
        // Act, Assert
        expect(categorizeTransaction('PAYROLL DEPOSIT', 'income', kw)).toBe('Trabalho');
    });

    it('ignores case', () => {
        // Act, Assert
        expect(categorizeTransaction('Netflix', 'expense', kw)).toBe('Lazer');
    });

    it('gives a description matching two categories to the one declared first', () => {
        // Act, Assert
        expect(categorizeTransaction('SENTINEL FOOD MARKET', 'expense', kw)).toBe('Mercado');
    });

    it('returns Sem Categoria for a description matching no keyword', () => {
        // Act, Assert
        expect(categorizeTransaction('xyzzy123unknown', 'expense', kw)).toBe(UNCATEGORIZED);
        expect(categorizeTransaction('xyzzy123unknown', 'income', kw)).toBe(UNCATEGORIZED);
    });

    it('falls back to Reembolso for income that only matches an expense keyword', () => {
        // Act, Assert
        expect(categorizeTransaction('SENTINEL CAFE', 'income', kw)).toBe('Reembolso');
    });

    it('prefers an income keyword over the Reembolso fallback', () => {
        // Act, Assert
        expect(categorizeTransaction('PAYROLL SENTINEL CAFE', 'income', kw)).toBe('Trabalho');
    });

    it('returns Sem Categoria for an unknown type instead of crashing', () => {
        // Act, Assert
        expect(categorizeTransaction('anything', 'badtype', kw)).toBe(UNCATEGORIZED);
    });

    it('returns Sem Categoria when the keyword map is missing', () => {
        // Act, Assert
        expect(categorizeTransaction('anything', 'expense')).toBe(UNCATEGORIZED);
    });

    it('returns Sem Categoria for everything when the map is empty', () => {
        // Act, Assert
        expect(categorizeTransaction('SENTINEL HOTEL', 'expense', { expense: {}, income: {} })).toBe(UNCATEGORIZED);
        expect(categorizeTransaction('SENTINEL HOTEL', 'income', { expense: {}, income: {} })).toBe(UNCATEGORIZED);
    });
});
