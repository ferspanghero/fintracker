import { describe, it, expect } from 'vitest';
import {
    emptySettings, findCategory, countCategoryUsage, addCategory, ensureCategory, removeCategory,
    addAsset, renameAsset, setAssetCurrency, setAssetArchived, setRate, applyRates,
    CURRENCIES, SETTINGS_VERSION, ASSET_TYPES, ASSET_CLASSES, FIRE_DEFAULTS,
    migrateSettings, assetName, setAssetDetails, findHolding, holdingNames, setHoldingSplit, setTargets,
    splitError, setFireInput, fireFieldError, parseTypedNumber
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
            assets: [],
            holdings: [],
            targets: {},
            fire: FIRE_DEFAULTS
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
        expect(result).toEqual({
            ok: true,
            asset: { id: 'asset-1', name: 'Savings', currency: 'USD', archived: false, type: null, institution: '', owner: '', holding: '' }
        });
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

describe('settings version 2', () => {
    it('is version 2 with asset classes in display order', () => {
        // Assert
        expect(SETTINGS_VERSION).toBe(2);
        expect(ASSET_CLASSES.map(c => c.key)).toEqual(['fixedIncome', 'canadaEquity', 'usEquity', 'intlEquity', 'emEquity', 'realEstate', 'cash']);
    });

    it.each([
        ['RRSP', false, 'RRSP'],
        ['RRSP/DPSP', false, 'RRSP'],
        ['TFSA', false, 'TFSA'],
        ['Non-registered', true, undefined],
        ['Stocks', true, undefined],
        ['Savings', true, undefined],
        ['Chequing', true, undefined],
        ['Real estate', false, undefined],
        ['Spousal RRSP', false, undefined]
    ])('type %s is taxed yearly: %s, room: %s', (name, taxedYearly, room) => {
        // Act
        const type = ASSET_TYPES.find(t => t.name === name);

        // Assert
        expect(type.taxedYearly).toBe(taxedYearly);
        expect(type.room).toBe(room);
    });
});

describe('migrateSettings', () => {
    it('fills version 1 settings with the new fields and defaults', () => {
        // Arrange
        const saved = {
            version: 1,
            rates: { USD: 1.4, BRL: null, date: null, refreshedAt: null },
            categories: { expense: ['Casa', UNCATEGORIZED], income: [UNCATEGORIZED] },
            assets: [{ id: 'a', name: 'Savings', currency: 'CAD', archived: false }]
        };

        // Act
        const migrated = migrateSettings(saved);

        // Assert
        expect(migrated).toEqual({
            ...saved,
            version: 2,
            assets: [{ id: 'a', name: 'Savings', currency: 'CAD', archived: false, type: null, institution: '', owner: '', holding: '' }],
            holdings: [],
            targets: {},
            fire: FIRE_DEFAULTS
        });
        expect(saved.version).toBe(1);
    });

    it('keeps saved FIRE inputs and fills the missing ones from the defaults', () => {
        // Act
        const migrated = migrateSettings({ fire: { swr: 3.5 } });

        // Assert
        expect(migrated.fire).toEqual({ ...FIRE_DEFAULTS, swr: 3.5 });
    });

    it.each([
        [{ spendingMode: 'fixed', fixedSpending: 40000 }, 40000],
        [{ spendingMode: 'last12', fixedSpending: 40000 }, null],
        [{ spendingMode: 'fixed', fixedSpending: 40000, retirementSpending: 70000 }, 70000]
    ])('reads stored spending %j as a retirement spending of %j', (fire, retirementSpending) => {
        // Act, Assert
        expect(migrateSettings({ fire }).fire).toEqual({ ...FIRE_DEFAULTS, retirementSpending });
    });

    it('drops FIRE inputs it does not know', () => {
        // Act, Assert
        expect(migrateSettings({ fire: { swr: 3, extra: 1 } }).fire).toEqual({ ...FIRE_DEFAULTS, swr: 3 });
    });

    it('turns empty saved settings into a fresh install', () => {
        // Act, Assert
        expect(migrateSettings({})).toEqual(emptySettings());
    });
});

describe('assetName', () => {
    it.each([
        [{ type: 'RRSP', institution: 'Broker', owner: 'Alex', holding: 'ETF1' }, 'RRSP Broker - Alex - ETF1'],
        [{ type: 'TFSA', institution: '', owner: 'Sam', holding: 'ETF2' }, 'TFSA - Sam - ETF2'],
        [{ type: 'Savings', institution: 'Bank', owner: '', holding: '' }, 'Savings Bank'],
        [{ type: 'Real estate', institution: '', owner: 'Joint', holding: 'Home' }, 'Real estate - Joint - Home']
    ])('builds %j as %j', (details, name) => {
        // Act, Assert
        expect(assetName(details)).toBe(name);
    });
});

describe('asset details', () => {
    const withAssets = () => {
        const settings = emptySettings();
        const ids = sequentialIds();
        addAsset(settings, 'Savings', 'CAD', ids);
        addAsset(settings, 'Brokerage', 'USD', ids);

        return settings;
    };

    it('generates the name from the details when a type is set', () => {
        // Arrange
        const settings = withAssets();

        // Act
        const result = setAssetDetails(settings, 'asset-2', { type: 'RRSP', institution: ' Broker ', owner: 'Alex', holding: 'ETF1' });

        // Assert
        expect(result).toEqual({ ok: true });
        expect(settings.assets[1]).toMatchObject({ name: 'RRSP Broker - Alex - ETF1', type: 'RRSP', institution: 'Broker', owner: 'Alex', holding: 'ETF1' });
    });

    it('keeps the typed name when the type is cleared', () => {
        // Arrange
        const settings = withAssets();
        setAssetDetails(settings, 'asset-2', { type: 'RRSP', institution: 'Broker', owner: 'Alex', holding: 'ETF1' });

        // Act
        const result = setAssetDetails(settings, 'asset-2', { type: '', institution: 'Broker', owner: 'Alex', holding: 'ETF1' });

        // Assert
        expect(result).toEqual({ ok: true });
        expect(settings.assets[1]).toMatchObject({ name: 'RRSP Broker - Alex - ETF1', type: null });
    });

    it.each([
        ['asset-9', { type: 'RRSP' }, 'Unknown asset.'],
        ['asset-2', { type: 'Crypto' }, 'Unknown asset type "Crypto".'],
        ['asset-2', { type: 'Savings' }, '"Savings" already exists.']
    ])('rejects %s with %j', (id, details, error) => {
        // Arrange
        const settings = withAssets();
        const before = structuredClone(settings.assets);

        // Act
        const result = setAssetDetails(settings, id, details);

        // Assert
        expect(result).toEqual({ ok: false, error });
        expect(settings.assets).toEqual(before);
    });

    it('refuses to rename an asset whose name comes from its details', () => {
        // Arrange
        const settings = withAssets();
        setAssetDetails(settings, 'asset-2', { type: 'TFSA', owner: 'Sam' });

        // Act
        const result = renameAsset(settings, 'asset-2', 'Other');

        // Assert
        expect(result).toEqual({ ok: false, error: 'The name comes from Type, Institution, Owner and Holding.' });
        expect(settings.assets[1].name).toBe('TFSA - Sam');
    });

    it('adds an asset with details under its generated name', () => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = addAsset(settings, 'ignored', 'CAD', () => 'x', { type: 'TFSA', institution: 'Broker', owner: 'Sam', holding: 'ETF2' });

        // Assert
        expect(result.ok).toBe(true);
        expect(settings.assets[0]).toEqual({
            id: 'x', name: 'TFSA Broker - Sam - ETF2', currency: 'CAD', archived: false, type: 'TFSA', institution: 'Broker', owner: 'Sam', holding: 'ETF2'
        });
    });

    it('rejects an unknown type when adding', () => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = addAsset(settings, 'Name', 'CAD', () => 'x', { type: 'Bonds' });

        // Assert
        expect(result).toEqual({ ok: false, error: 'Unknown asset type "Bonds".' });
        expect(settings.assets).toEqual([]);
    });
});

describe('holding splits', () => {
    const withHoldings = () => {
        const settings = emptySettings();
        const ids = sequentialIds();
        addAsset(settings, 'n', 'CAD', ids, { type: 'TFSA', owner: 'Sam', holding: 'ETF1' });
        addAsset(settings, 'n', 'CAD', ids, { type: 'RRSP', owner: 'Alex', holding: 'etf1' });
        addAsset(settings, 'n', 'CAD', ids, { type: 'RRSP', owner: 'Sam', holding: '__proto__' });
        addAsset(settings, 'Plain', 'CAD', ids);

        return settings;
    };

    it('lists distinct holdings ignoring case, in asset order', () => {
        // Act, Assert
        expect(holdingNames(withHoldings())).toEqual(['ETF1', '__proto__']);
    });

    it('stores a split that adds up to 100, dropping zero classes', () => {
        // Arrange
        const settings = withHoldings();

        // Act
        const result = setHoldingSplit(settings, 'ETF1', { usEquity: '60', intlEquity: '30.5', emEquity: '9.5', fixedIncome: '0', cash: '' });

        // Assert
        expect(result).toEqual({ ok: true });
        expect(settings.holdings).toEqual([{ name: 'ETF1', split: { usEquity: 60, intlEquity: 30.5, emEquity: 9.5 } }]);
        expect(findHolding(settings, 'etf1')).toEqual({ usEquity: 60, intlEquity: 30.5, emEquity: 9.5 });
    });

    it('replaces an existing split for the same holding in any case', () => {
        // Arrange
        const settings = withHoldings();
        setHoldingSplit(settings, 'ETF1', { usEquity: 100 });

        // Act
        setHoldingSplit(settings, 'etf1', { canadaEquity: 100 });

        // Assert
        expect(settings.holdings).toEqual([{ name: 'ETF1', split: { canadaEquity: 100 } }]);
    });

    it('stores a split for a holding named like an object property without touching prototypes', () => {
        // Arrange
        const settings = withHoldings();

        // Act
        setHoldingSplit(settings, '__proto__', { cash: 100 });

        // Assert
        expect(findHolding(settings, '__proto__')).toEqual({ cash: 100 });
        expect({}.cash).toBeUndefined();
    });

    it('clears the split when every class is blank', () => {
        // Arrange
        const settings = withHoldings();
        setHoldingSplit(settings, 'ETF1', { usEquity: 100 });

        // Act
        const result = setHoldingSplit(settings, 'ETF1', { usEquity: '' });

        // Assert
        expect(result).toEqual({ ok: true });
        expect(settings.holdings).toEqual([]);
        expect(findHolding(settings, 'ETF1')).toBeUndefined();
    });

    it.each([
        [{ usEquity: '60', cash: '30' }, 'The split adds up to 90%; it must be 100%.'],
        [{ usEquity: '120' }, 'Each share must be a number from 0 to 100.'],
        [{ usEquity: 'abc' }, 'Each share must be a number from 0 to 100.'],
        [{ gold: '100' }, 'Unknown asset class "gold".']
    ])('rejects split %j', (split, error) => {
        // Arrange
        const settings = withHoldings();

        // Act
        const result = setHoldingSplit(settings, 'ETF1', split);

        // Assert
        expect(result).toEqual({ ok: false, error });
        expect(settings.holdings).toEqual([]);
    });

    it('rejects a blank holding name', () => {
        // Act, Assert
        expect(setHoldingSplit(withHoldings(), ' ', { cash: 100 })).toEqual({ ok: false, error: 'Unknown holding.' });
    });

    it.each([
        [{ usEquity: 100 }, null],
        [{ usEquity: 50, cash: 49.995 }, null],
        [{ usEquity: 50 }, 'The split adds up to 50%; it must be 100%.'],
        [{ usEquity: -10, cash: 110 }, 'Each share must be a number from 0 to 100.'],
        [{ gold: 100 }, 'Unknown asset class "gold".'],
        [[100], 'The split must be an object.'],
        [null, 'The split must be an object.']
    ])('splitError(%j) is %j', (split, error) => {
        // Act, Assert
        expect(splitError(split)).toBe(error);
    });
});

describe('setTargets', () => {
    it('stores targets that add up to 100', () => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = setTargets(settings, { canadaEquity: '25', usEquity: '75', cash: '' });

        // Assert
        expect(result).toEqual({ ok: true });
        expect(settings.targets).toEqual({ canadaEquity: 25, usEquity: 75 });
    });

    it('keeps a 0% target apart from a blank one', () => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = setTargets(settings, { usEquity: '100', fixedIncome: '0', cash: '' });

        // Assert
        expect(result).toEqual({ ok: true });
        expect(settings.targets).toEqual({ fixedIncome: 0, usEquity: 100 });
    });

    it('clears the targets when every class is blank', () => {
        // Arrange
        const settings = emptySettings();
        setTargets(settings, { cash: 100 });

        // Act
        setTargets(settings, { cash: '' });

        // Assert
        expect(settings.targets).toEqual({});
    });

    it('rejects targets that do not add up to 100', () => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = setTargets(settings, { cash: '20' });

        // Assert
        expect(result).toEqual({ ok: false, error: 'The split adds up to 20%; it must be 100%.' });
        expect(settings.targets).toEqual({});
    });
});

describe('FIRE_DEFAULTS', () => {
    it('leaves retirement spending blank so the last 12 months are used', () => {
        // Assert
        expect(FIRE_DEFAULTS.retirementSpending).toBeNull();
        expect(FIRE_DEFAULTS).not.toHaveProperty('spendingMode');
    });
});

describe('setFireInput', () => {
    it.each([
        ['swr', '3.5', 3.5],
        ['withdrawalTax', '0', 0],
        ['expectedReturn', '-1.5', -1.5],
        ['inflation', '2.25', 2.25],
        ['nonRegTaxDrag', '15', 15],
        ['retirementSpending', '60,000', 60000],
        ['retirementSpending', '', null],
        ['birthYear', '1990', 1990],
        ['birthYear', ' ', null],
        ['projectionStart', '2017', 2017],
        ['projectionEnd', '2037', 2037]
    ])('stores %s = %j as %j', (field, raw, value) => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = setFireInput(settings, field, raw);

        // Assert
        expect(result).toEqual({ ok: true });
        expect(settings.fire[field]).toBe(value);
    });

    it.each([
        ['swr', '0', 'Enter a number above 0 and up to 100.'],
        ['swr', '', 'Enter a number above 0 and up to 100.'],
        ['withdrawalTax', '100', 'Enter a number from 0 to below 100.'],
        ['nonRegTaxDrag', '-1', 'Enter a number from 0 to below 100.'],
        ['expectedReturn', 'abc', 'Enter a number.'],
        ['inflation', '', 'Enter a number above -100.'],
        ['inflation', '-100', 'Enter a number above -100.'],
        ['retirementSpending', '-5', 'Enter an amount of 0 or more.'],
        ['spendingMode', 'fixed', 'Unknown setting "spendingMode".'],
        ['birthYear', '1990.5', 'Enter a year from 1900 to 2100.'],
        ['projectionEnd', '1800', 'Enter a year from 1900 to 2100.'],
        ['constructor', '1', 'Unknown setting "constructor".']
    ])('rejects %s = %j', (field, raw, error) => {
        // Arrange
        const settings = emptySettings();

        // Act
        const result = setFireInput(settings, field, raw);

        // Assert
        expect(result).toEqual({ ok: false, error });
        expect(settings.fire).toEqual(FIRE_DEFAULTS);
    });

    it.each([
        ['projectionEnd', '2017', { projectionStart: 2020 }],
        ['projectionStart', '2040', { projectionEnd: 2037 }]
    ])('rejects %s = %s when the end would not be after the start', (field, raw, fire) => {
        // Arrange
        const settings = emptySettings();
        Object.assign(settings.fire, fire);

        // Act
        const result = setFireInput(settings, field, raw);

        // Assert
        expect(result).toEqual({ ok: false, error: 'The projection end year must be after its start year.' });
    });

    it('checks stored values the same way', () => {
        // Act, Assert
        expect(fireFieldError('swr', 4)).toBeNull();
        expect(fireFieldError('swr', '4')).toBe('Enter a number above 0 and up to 100.');
        expect(fireFieldError('birthYear', null)).toBeNull();
        expect(fireFieldError('expectedReturn', Infinity)).toBe('Enter a number.');
    });
});

describe('parseTypedNumber', () => {
    it.each([
        ['1,234.5', 1234.5],
        ['-2', -2],
        ['.5', 0.5],
        ['1e3', NaN],
        ['12abc', NaN],
        ['', NaN]
    ])('reads %j as %j', (typed, value) => {
        // Act, Assert
        expect(parseTypedNumber(typed)).toBe(value);
    });
});
