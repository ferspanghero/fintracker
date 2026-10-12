import { describe, it, expect } from 'vitest';
import {
    emptySettings, findCategory, countCategoryUsage, addCategory, ensureCategory, removeCategory,
    addAsset, renameAsset, setAssetCurrency, setAssetArchived, setRate, applyRates,
    CURRENCIES, SETTINGS_VERSION
} from '../js/settings.js';
import { UNCATEGORIZED } from '../js/category-engine.js';

const sequentialIds = () => {
    let next = 0;

    return () => `asset-${++next}`;
};

describe('emptySettings', () => {
    it('starts with only Sem Categoria, no assets and no rates', () => {
        // Act
        const settings = emptySettings();

        // Assert
        expect(settings).toEqual({
            version: SETTINGS_VERSION,
            rates: { USD: null, BRL: null, date: null, refreshedAt: null },
            categories: { expense: [UNCATEGORIZED], income: [UNCATEGORIZED] },
            assets: []
        });
    });

    it('returns a fresh object on every call', () => {
        // Arrange
        const first = emptySettings();

        // Act
        first.categories.expense.push('Casa');

        // Assert
        expect(emptySettings().categories.expense).toEqual([UNCATEGORIZED]);
    });

    it('supports CAD, USD and BRL assets', () => {
        // Act, Assert
        expect(CURRENCIES).toEqual(['CAD', 'USD', 'BRL']);
    });
});

describe('findCategory', () => {
    it.each([
        ['casa', 'Casa'],
        ['  CASA  ', 'Casa'],
        ['Mercado', undefined],
        ['', undefined]
    ])('finds %j case-insensitively as %j', (name, expected) => {
        // Arrange
        const settings = emptySettings();
        settings.categories.expense.push('Casa');

        // Act, Assert
        expect(findCategory(settings, 'expense', name)).toBe(expected);
    });
});

describe('countCategoryUsage', () => {
    it('counts only transactions of the same type and name', () => {
        // Arrange
        const transactions = [
            { type: 'expense', category: 'Outro' },
            { type: 'expense', category: 'Outro' },
            { type: 'income', category: 'Outro' },
            { type: 'expense', category: 'Casa' }
        ];

        // Act, Assert
        expect(countCategoryUsage(transactions, 'expense', 'Outro')).toBe(2);
    });
});

describe('addCategory', () => {
    it('adds a trimmed name before Sem Categoria', () => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = addCategory(settings, 'expense', '  Pets ');

        // Assert
        expect(result).toEqual({ ok: true, name: 'Pets' });
        expect(settings.categories.expense).toEqual(['Pets', UNCATEGORIZED]);
    });

    it.each([
        ['', 'Enter a category name.'],
        ['   ', 'Enter a category name.'],
        ['sem categoria', '"Sem Categoria" already exists.']
    ])('rejects %j', (name, error) => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = addCategory(settings, 'income', name);

        // Assert
        expect(result).toEqual({ ok: false, error });
        expect(settings.categories.income).toEqual([UNCATEGORIZED]);
    });

    it('rejects a duplicate in a different case', () => {
        // Arrange
        const settings = emptySettings();
        addCategory(settings, 'expense', 'Pets');

        // Act
        const result = addCategory(settings, 'expense', 'PETS');

        // Assert
        expect(result).toEqual({ ok: false, error: '"Pets" already exists.' });
        expect(settings.categories.expense).toEqual(['Pets', UNCATEGORIZED]);
    });

    it('allows the same name in the other type', () => {
        // Arrange
        const settings = emptySettings();
        addCategory(settings, 'expense', 'Outro');

        // Act
        const result = addCategory(settings, 'income', 'Outro');

        // Assert
        expect(result.ok).toBe(true);
        expect(settings.categories.income).toEqual(['Outro', UNCATEGORIZED]);
    });

    it('rejects an unknown type', () => {
        // Act
        const result = addCategory(emptySettings(), 'transfer', 'Pets');

        // Assert
        expect(result).toEqual({ ok: false, error: 'Unknown category type "transfer".' });
    });
});

describe('ensureCategory', () => {
    it('returns the stored spelling of a known category without adding it', () => {
        // Arrange
        const settings = emptySettings();
        addCategory(settings, 'expense', 'Casa');

        // Act
        const name = ensureCategory(settings, 'expense', '  casa ');

        // Assert
        expect(name).toBe('Casa');
        expect(settings.categories.expense).toEqual(['Casa', UNCATEGORIZED]);
    });

    it('adds an unknown category before Sem Categoria and returns its trimmed name', () => {
        // Arrange
        const settings = emptySettings();

        // Act
        const name = ensureCategory(settings, 'income', ' Pets ');

        // Assert
        expect(name).toBe('Pets');
        expect(settings.categories.income).toEqual(['Pets', UNCATEGORIZED]);
    });

    it('adds a repeated unknown category only once', () => {
        // Arrange
        const settings = emptySettings();

        // Act
        ensureCategory(settings, 'expense', 'Pets');
        ensureCategory(settings, 'expense', 'PETS');

        // Assert
        expect(settings.categories.expense).toEqual(['Pets', UNCATEGORIZED]);
    });

    it.each(['', '   ', null, undefined])('files a blank name (%j) under Sem Categoria', blank => {
        // Arrange
        const settings = emptySettings();

        // Act
        const name = ensureCategory(settings, 'expense', blank);

        // Assert
        expect(name).toBe(UNCATEGORIZED);
        expect(settings.categories.expense).toEqual([UNCATEGORIZED]);
    });
});

describe('removeCategory', () => {
    it('removes an unused category', () => {
        // Arrange
        const settings = emptySettings();
        addCategory(settings, 'expense', 'Pets');

        // Act
        const result = removeCategory(settings, 'expense', 'Pets', [{ type: 'income', category: 'Pets' }]);

        // Assert
        expect(result).toEqual({ ok: true });
        expect(settings.categories.expense).toEqual([UNCATEGORIZED]);
    });

    it('refuses a category in use and reports the count', () => {
        // Arrange
        const settings = emptySettings();
        addCategory(settings, 'expense', 'Pets');
        const transactions = [1, 2, 3].map(() => ({ type: 'expense', category: 'Pets' }));

        // Act
        const result = removeCategory(settings, 'expense', 'Pets', transactions);

        // Assert
        expect(result).toEqual({ ok: false, error: 'Used by 3 transactions.' });
        expect(settings.categories.expense).toContain('Pets');
    });

    it('uses the singular for one transaction', () => {
        // Arrange
        const settings = emptySettings();
        addCategory(settings, 'expense', 'Pets');

        // Act
        const result = removeCategory(settings, 'expense', 'Pets', [{ type: 'expense', category: 'Pets' }]);

        // Assert
        expect(result.error).toBe('Used by 1 transaction.');
    });

    it('never removes Sem Categoria', () => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = removeCategory(settings, 'expense', UNCATEGORIZED, []);

        // Assert
        expect(result).toEqual({ ok: false, error: '"Sem Categoria" can\'t be removed.' });
        expect(settings.categories.expense).toEqual([UNCATEGORIZED]);
    });

    it('reports a missing category', () => {
        // Act
        const result = removeCategory(emptySettings(), 'expense', 'Pets', []);

        // Assert
        expect(result).toEqual({ ok: false, error: '"Pets" doesn\'t exist.' });
    });
});

describe('addAsset', () => {
    it('adds an active asset with a generated id', () => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = addAsset(settings, ' Savings ', 'USD', sequentialIds());

        // Assert
        expect(result).toEqual({ ok: true, asset: { id: 'asset-1', name: 'Savings', currency: 'USD', archived: false } });
        expect(settings.assets).toEqual([result.asset]);
    });

    it('uses crypto.randomUUID by default', () => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = addAsset(settings, 'Savings', 'CAD');

        // Assert
        expect(result.asset.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it.each([
        ['', 'CAD', 'Enter an asset name.'],
        ['Brokerage', 'EUR', 'Unsupported currency "EUR".'],
        ['savings', 'CAD', '"Savings" already exists.']
    ])('rejects name %j with currency %j', (name, currency, error) => {
        // Arrange
        const settings = emptySettings();
        addAsset(settings, 'Savings', 'CAD', sequentialIds());

        // Act
        const result = addAsset(settings, name, currency, () => 'other');

        // Assert
        expect(result).toEqual({ ok: false, error });
        expect(settings.assets).toHaveLength(1);
    });
});

describe('asset edits', () => {
    const settingsWithTwoAssets = () => {
        const settings = emptySettings();
        const ids = sequentialIds();
        addAsset(settings, 'Savings', 'CAD', ids);
        addAsset(settings, 'Brokerage', 'USD', ids);

        return settings;
    };

    it('renames an asset', () => {
        // Arrange
        const settings = settingsWithTwoAssets();

        // Act
        const result = renameAsset(settings, 'asset-1', ' Emergency fund ');

        // Assert
        expect(result).toEqual({ ok: true });
        expect(settings.assets[0].name).toBe('Emergency fund');
    });

    it('keeps the name when renaming to its own name in another case', () => {
        // Arrange
        const settings = settingsWithTwoAssets();

        // Act
        const result = renameAsset(settings, 'asset-1', 'SAVINGS');

        // Assert
        expect(result).toEqual({ ok: true });
        expect(settings.assets[0].name).toBe('SAVINGS');
    });

    it.each([
        ['asset-1', 'brokerage', '"Brokerage" already exists.'],
        ['asset-1', ' ', 'Enter an asset name.'],
        ['missing', 'Other', 'Unknown asset.']
    ])('refuses to rename %s to %j', (id, name, error) => {
        // Arrange
        const settings = settingsWithTwoAssets();

        // Act
        const result = renameAsset(settings, id, name);

        // Assert
        expect(result).toEqual({ ok: false, error });
        expect(settings.assets.map(a => a.name)).toEqual(['Savings', 'Brokerage']);
    });

    it('changes the currency', () => {
        // Arrange
        const settings = settingsWithTwoAssets();

        // Act
        const result = setAssetCurrency(settings, 'asset-1', 'BRL');

        // Assert
        expect(result).toEqual({ ok: true });
        expect(settings.assets[0].currency).toBe('BRL');
    });

    it.each([
        ['asset-1', 'EUR', 'Unsupported currency "EUR".'],
        ['missing', 'CAD', 'Unknown asset.']
    ])('refuses currency change for %s to %s', (id, currency, error) => {
        // Arrange
        const settings = settingsWithTwoAssets();

        // Act, Assert
        expect(setAssetCurrency(settings, id, currency)).toEqual({ ok: false, error });
        expect(settings.assets[0].currency).toBe('CAD');
    });

    it('archives and unarchives', () => {
        // Arrange
        const settings = settingsWithTwoAssets();

        // Act
        setAssetArchived(settings, 'asset-2', true);
        const archived = settings.assets[1].archived;
        setAssetArchived(settings, 'asset-2', false);

        // Assert
        expect(archived).toBe(true);
        expect(settings.assets[1].archived).toBe(false);
    });

    it('refuses to archive an unknown asset', () => {
        // Act, Assert
        expect(setAssetArchived(settingsWithTwoAssets(), 'missing', true)).toEqual({ ok: false, error: 'Unknown asset.' });
    });
});

describe('setRate', () => {
    it.each([
        ['1.4271', 1.4271],
        [' 0.286 ', 0.286],
        [1.5, 1.5],
        ['', null],
        [null, null]
    ])('accepts %j as %j', (raw, expected) => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = setRate(settings, 'USD', raw);

        // Assert
        expect(result).toEqual({ ok: true });
        expect(settings.rates.USD).toBe(expected);
    });

    it.each(['0', '-1', 'abc', 'Infinity', '1.2.3', '0x10', '0,28', '1e2'])('rejects %j', raw => {
        // Arrange
        const settings = emptySettings();
        settings.rates.BRL = 0.25;

        // Act
        const result = setRate(settings, 'BRL', raw);

        // Assert
        expect(result).toEqual({ ok: false, error: 'Enter a positive number.' });
        expect(settings.rates.BRL).toBe(0.25);
    });

    it('rejects an unsupported currency', () => {
        // Act, Assert
        expect(setRate(emptySettings(), 'CAD', '1')).toEqual({ ok: false, error: 'Unsupported currency "CAD".' });
    });
});

describe('applyRates', () => {
    it('stores both rates, their date and the refresh time', () => {
        // Arrange
        const settings = emptySettings();
        const now = new Date('2026-10-11T12:00:00Z');

        // Act
        applyRates(settings, { USD: 1.4, BRL: 0.27, date: '2026-10-09' }, now);

        // Assert
        expect(settings.rates).toEqual({ USD: 1.4, BRL: 0.27, date: '2026-10-09', refreshedAt: '2026-10-11T12:00:00.000Z' });
    });
});
