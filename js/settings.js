// Pure rules for the app-wide settings: exchange rates, the one category
// list and asset definitions. No DOM or storage access. Every mutator returns
// `{ ok: true, ... }` or `{ ok: false, error }` and changes nothing on failure;
// `error` is a user-facing message.

import { UNCATEGORIZED } from './category-engine.js';

export const SETTINGS_VERSION = 1;
export const CURRENCIES = ['CAD', 'USD', 'BRL'];
export const RATE_CURRENCIES = ['USD', 'BRL'];
export const CATEGORY_TYPES = ['expense', 'income'];

/**
 * Settings for a fresh install: only "Sem Categoria" in each type, no assets, no rates.
 * @returns {object} a new settings object
 */
export function emptySettings() {
    return {
        version: SETTINGS_VERSION,
        rates: { USD: null, BRL: null, date: null, refreshedAt: null },
        categories: { expense: [UNCATEGORIZED], income: [UNCATEGORIZED] },
        assets: []
    };
}

const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
const fail = error => ({ ok: false, error });

/**
 * Finds a category of `type` whose name matches `name` ignoring case and surrounding spaces.
 * @returns {string|undefined} the stored spelling, or undefined when absent
 */
export function findCategory(settings, type, name) {
    const wanted = String(name ?? '').trim();

    if (!wanted) {
        return undefined;
    }

    return settings.categories[type]?.find(existing => sameName(existing, wanted));
}

/**
 * Counts the transactions of `type` filed under category `name`.
 * @returns {number}
 */
export function countCategoryUsage(transactions, type, name) {
    return transactions.filter(t => t.type === type && t.category === name).length;
}

/**
 * Adds a category, kept just before "Sem Categoria" so that one stays last.
 * Names are trimmed, non-empty and unique per type ignoring case.
 * @returns {{ok: true, name: string} | {ok: false, error: string}}
 */
export function addCategory(settings, type, name) {
    if (!CATEGORY_TYPES.includes(type)) {
        return fail(`Unknown category type "${type}".`);
    }

    const trimmed = String(name ?? '').trim();

    if (!trimmed) {
        return fail('Enter a category name.');
    }

    const existing = findCategory(settings, type, trimmed);

    if (existing) {
        return fail(`"${existing}" already exists.`);
    }

    const list = settings.categories[type];
    const uncategorizedIndex = list.indexOf(UNCATEGORIZED);
    list.splice(uncategorizedIndex === -1 ? list.length : uncategorizedIndex, 0, trimmed);

    return { ok: true, name: trimmed };
}

/**
 * Removes a category no transaction uses. "Sem Categoria" is permanent.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function removeCategory(settings, type, name, transactions) {
    if (name === UNCATEGORIZED) {
        return fail(`"${UNCATEGORIZED}" can't be removed.`);
    }

    const list = settings.categories[type] ?? [];
    const index = list.indexOf(name);

    if (index === -1) {
        return fail(`"${name}" doesn't exist.`);
    }

    const used = countCategoryUsage(transactions, type, name);

    if (used > 0) {
        return fail(`Used by ${used} transaction${used === 1 ? '' : 's'}.`);
    }

    list.splice(index, 1);

    return { ok: true };
}

function checkAssetName(settings, name, selfId) {
    const trimmed = String(name ?? '').trim();

    if (!trimmed) {
        return { error: 'Enter an asset name.' };
    }

    const clash = settings.assets.find(a => a.id !== selfId && sameName(a.name, trimmed));

    if (clash) {
        return { error: `"${clash.name}" already exists.` };
    }

    return { name: trimmed };
}

const unsupportedCurrency = currency => fail(`Unsupported currency "${currency}".`);

/**
 * Adds an active asset. Names are unique ignoring case; ids come from `idFn`.
 * @returns {{ok: true, asset: object} | {ok: false, error: string}}
 */
export function addAsset(settings, name, currency, idFn = () => crypto.randomUUID()) {
    const checked = checkAssetName(settings, name);

    if (checked.error) {
        return fail(checked.error);
    }

    if (!CURRENCIES.includes(currency)) {
        return unsupportedCurrency(currency);
    }

    const asset = { id: idFn(), name: checked.name, currency, archived: false };
    settings.assets.push(asset);

    return { ok: true, asset };
}

const findAsset = (settings, id) => settings.assets.find(a => a.id === id);

/**
 * Renames an asset; the new name must be non-empty and not used by another asset.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function renameAsset(settings, id, name) {
    const asset = findAsset(settings, id);

    if (!asset) {
        return fail('Unknown asset.');
    }

    const checked = checkAssetName(settings, name, id);

    if (checked.error) {
        return fail(checked.error);
    }

    asset.name = checked.name;

    return { ok: true };
}

/**
 * Changes an asset's currency. Stored balances keep their numbers, now read in the new currency.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function setAssetCurrency(settings, id, currency) {
    const asset = findAsset(settings, id);

    if (!asset) {
        return fail('Unknown asset.');
    }

    if (!CURRENCIES.includes(currency)) {
        return unsupportedCurrency(currency);
    }

    asset.currency = currency;

    return { ok: true };
}

/**
 * Archives or unarchives an asset. Assets are never deleted so history keeps its rows.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function setAssetArchived(settings, id, archived) {
    const asset = findAsset(settings, id);

    if (!asset) {
        return fail('Unknown asset.');
    }

    asset.archived = Boolean(archived);

    return { ok: true };
}

/**
 * Sets one → CAD rate from user input. Blank clears it; otherwise it must be a positive number.
 * @param {string|number|null} raw
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function setRate(settings, currency, raw) {
    if (!RATE_CURRENCIES.includes(currency)) {
        return unsupportedCurrency(currency);
    }

    const text = String(raw ?? '').trim();

    if (!text) {
        settings.rates[currency] = null;

        return { ok: true };
    }

    const value = /^(\d+\.?\d*|\.\d+)$/.test(text) ? Number(text) : NaN;

    if (!Number.isFinite(value) || value <= 0) {
        return fail('Enter a positive number.');
    }

    settings.rates[currency] = value;

    return { ok: true };
}

/**
 * Stores freshly fetched rates with their publication date and the refresh time.
 * @param {{USD: number, BRL: number, date: string}} rates
 * @param {Date} now
 */
export function applyRates(settings, { USD, BRL, date }, now) {
    Object.assign(settings.rates, { USD, BRL, date, refreshedAt: now.toISOString() });
}
