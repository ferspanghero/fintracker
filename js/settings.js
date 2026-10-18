// Pure rules for the app-wide settings: exchange rates, the one category
// list, asset definitions, holdings' asset-class splits, target allocation and
// the FIRE inputs. No DOM or storage access. Every mutator returns
// `{ ok: true, ... }` or `{ ok: false, error }` and changes nothing on failure;
// `error` is a user-facing message.

import { UNCATEGORIZED } from './category-engine.js';
import { BASE_CURRENCY, TRANSACTION_TYPES } from './constants.js';

export const SETTINGS_VERSION = 2;
export const RATE_CURRENCIES = ['USD', 'BRL'];
export const CURRENCIES = [BASE_CURRENCY, ...RATE_CURRENCIES];

/** Asset classes in display order; `short` labels a holding's split summary. */
export const ASSET_CLASSES = Object.freeze([
    { key: 'fixedIncome', label: 'Fixed Income / Bonds', short: 'Bonds' },
    { key: 'canadaEquity', label: 'Canada Equity', short: 'Canada' },
    { key: 'usEquity', label: 'US Equity', short: 'US' },
    { key: 'intlEquity', label: 'Intl Equity', short: 'Intl' },
    { key: 'emEquity', label: 'Emerging Markets Equity', short: 'EM' },
    { key: 'realEstate', label: 'Real Estate', short: 'Real estate' },
    { key: 'cash', label: 'Cash', short: 'Cash' }
]);

/**
 * Account types. `taxedYearly` marks growth taxed every year (it gets the projection's tax drag);
 * `room` names the registered-room account its contributions count against.
 */
export const ASSET_TYPES = Object.freeze([
    { name: 'RRSP', taxedYearly: false, room: 'RRSP' },
    { name: 'RRSP/DPSP', taxedYearly: false, room: 'RRSP' },
    // Owned by the annuitant spouse; contributions count against the contributor's room, entered under their name.
    { name: 'Spousal RRSP', taxedYearly: false },
    { name: 'TFSA', taxedYearly: false, room: 'TFSA' },
    { name: 'Non-registered', taxedYearly: true },
    { name: 'Stocks', taxedYearly: true },
    { name: 'Savings', taxedYearly: true },
    { name: 'Chequing', taxedYearly: true },
    { name: 'Real estate', taxedYearly: false }
]);

/**
 * FIRE inputs for a fresh install; percentages are stored as numbers (4 means 4%).
 * Null means "use the default worked out from your data": retirement spending falls back to the
 * last 12 months of expenses and the projection years to the first year with balances through 20 years out.
 */
export const FIRE_DEFAULTS = Object.freeze({
    swr: 4,
    withdrawalTax: 20,
    retirementSpending: null,
    expectedReturn: 7,
    inflation: 2,
    nonRegTaxDrag: 10,
    birthYear: null,
    projectionStart: null,
    projectionEnd: null
});

const EMPTY_DETAILS = Object.freeze({ type: null, institution: '', owner: '', holding: '' });

/**
 * Settings for a fresh install: only "Sem Categoria" in each type, no assets, no rates.
 * @returns {object} a new settings object
 */
export function emptySettings() {
    return {
        version: SETTINGS_VERSION,
        rates: { USD: null, BRL: null, date: null, refreshedAt: null },
        categories: { expense: [UNCATEGORIZED], income: [UNCATEGORIZED] },
        assets: [],
        holdings: [],
        targets: {},
        fire: { ...FIRE_DEFAULTS }
    };
}

/**
 * Brings saved settings of any version to the current shape without changing the input:
 * assets gain empty details, and missing holdings, targets and FIRE inputs get their defaults.
 * @param {object} saved settings as stored (possibly partial)
 * @returns {object} new settings at SETTINGS_VERSION
 */
export function migrateSettings(saved) {
    const fresh = emptySettings();

    return {
        ...fresh,
        ...structuredClone(saved),
        version: SETTINGS_VERSION,
        // Details go after the existing fields, in the order addAsset writes them.
        assets: (saved.assets ?? []).map(asset => ({
            ...asset,
            ...Object.fromEntries(Object.entries(EMPTY_DETAILS).map(([field, empty]) => [field, asset[field] ?? empty]))
        })),
        holdings: structuredClone(saved.holdings ?? fresh.holdings),
        targets: structuredClone(saved.targets ?? fresh.targets),
        fire: migrateFire(saved.fire)
    };
}

/**
 * FIRE inputs in the current shape: defaults filled, unknown fields dropped, and an earlier
 * fixed-spending choice carried over as the retirement spending override.
 * @param {object} [saved] FIRE inputs as stored
 * @returns {object}
 */
export function migrateFire(saved = {}) {
    const merged = { ...FIRE_DEFAULTS, ...saved };

    if (!Object.hasOwn(saved, 'retirementSpending') && saved.spendingMode === 'fixed') {
        merged.retirementSpending = saved.fixedSpending ?? null;
    }

    return Object.fromEntries(Object.keys(FIRE_DEFAULTS).map(field => [field, merged[field]]));
}

/** @returns {boolean} whether two names match ignoring case */
export const sameName = (a, b) => a.toLowerCase() === b.toLowerCase();
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
    if (!TRANSACTION_TYPES.includes(type)) {
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
 * Makes sure a transaction's category is in the list, for write paths that store
 * categories from outside the app (e.g. a FinTracker import).
 * @returns {string} the stored spelling of `name`, newly added when unknown;
 *          "Sem Categoria" when `name` is blank
 */
export function ensureCategory(settings, type, name) {
    const existing = findCategory(settings, type, name);

    if (existing) {
        return existing;
    }

    const added = addCategory(settings, type, name);

    return added.ok ? added.name : UNCATEGORIZED;
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
const isAssetType = type => ASSET_TYPES.some(t => t.name === type);
const text = value => String(value ?? '').trim();

/**
 * The name an asset with a type gets: `{Type} {Institution} - {Owner} - {Holding}`, blank parts skipped.
 * @param {{type: string, institution?: string, owner?: string, holding?: string}} details
 * @returns {string}
 */
export function assetName({ type, institution, owner, holding }) {
    const head = [type, institution].map(text).filter(Boolean).join(' ');

    return [head, text(owner), text(holding)].filter(Boolean).join(' - ');
}

// Trimmed details; a blank type becomes null. `error` is set for an unknown type.
function normalizeDetails(details) {
    const type = text(details.type) || null;

    if (type !== null && !isAssetType(type)) {
        return { error: `Unknown asset type "${type}".` };
    }

    return { details: { type, institution: text(details.institution), owner: text(details.owner), holding: text(details.holding) } };
}

/**
 * Adds an active asset. Names are unique ignoring case; ids come from `idFn`.
 * With a type in `details`, the name is generated from the details and `name` is ignored.
 * @param {{type?: string, institution?: string, owner?: string, holding?: string}} [details]
 * @returns {{ok: true, asset: object} | {ok: false, error: string}}
 */
export function addAsset(settings, name, currency, idFn = () => crypto.randomUUID(), details = {}) {
    const normalized = normalizeDetails(details);

    if (normalized.error) {
        return fail(normalized.error);
    }

    const checked = checkAssetName(settings, normalized.details.type ? assetName(normalized.details) : name);

    if (checked.error) {
        return fail(checked.error);
    }

    if (!CURRENCIES.includes(currency)) {
        return unsupportedCurrency(currency);
    }

    const asset = { id: idFn(), name: checked.name, currency, archived: false, ...normalized.details };
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

    if (asset.type) {
        return fail('The name comes from Type, Institution, Owner and Holding.');
    }

    const checked = checkAssetName(settings, name, id);

    if (checked.error) {
        return fail(checked.error);
    }

    asset.name = checked.name;

    return { ok: true };
}

/**
 * Sets an asset's type, institution, owner and holding. With a type, the name is regenerated
 * from them and must stay unique; without one, the current name is kept.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function setAssetDetails(settings, id, details) {
    const asset = findAsset(settings, id);

    if (!asset) {
        return fail('Unknown asset.');
    }

    const normalized = normalizeDetails(details);

    if (normalized.error) {
        return fail(normalized.error);
    }

    const checked = checkAssetName(settings, normalized.details.type ? assetName(normalized.details) : asset.name, id);

    if (checked.error) {
        return fail(checked.error);
    }

    Object.assign(asset, normalized.details, { name: checked.name });

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

/**
 * Distinct non-blank holdings of all assets, ignoring case; the first spelling wins.
 * @returns {string[]}
 */
export function holdingNames(settings) {
    const names = [];

    settings.assets.forEach(({ holding }) => {
        if (holding && !names.some(name => sameName(name, holding))) {
            names.push(holding);
        }
    });

    return names;
}

/**
 * The asset-class split of a holding, matched ignoring case.
 * @returns {object|undefined} class key → share (0–100), or undefined when the holding has none
 */
export function findHolding(settings, holding) {
    const wanted = text(holding);

    return wanted ? settings.holdings.find(entry => sameName(entry.name, wanted))?.split : undefined;
}

const SPLIT_TOLERANCE = 0.01;
export const CLASS_KEYS = ASSET_CLASSES.map(c => c.key);
const isShare = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;

/**
 * Checks a stored split: known class keys, shares from 0 to 100 adding up to 100.
 * @returns {string|null} the problem, or null when valid
 */
export function splitError(split) {
    if (typeof split !== 'object' || split === null || Array.isArray(split)) {
        return 'The split must be an object.';
    }

    const unknown = Object.keys(split).find(key => !CLASS_KEYS.includes(key));

    if (unknown) {
        return `Unknown asset class "${unknown}".`;
    }

    const shares = Object.values(split);

    if (!shares.every(isShare)) {
        return 'Each share must be a number from 0 to 100.';
    }

    const total = shares.reduce((sum, share) => sum + share, 0);

    return Math.abs(total - 100) <= SPLIT_TOLERANCE ? null : `The split adds up to ${Number(total.toFixed(2))}%; it must be 100%.`;
}

// Parses typed shares: blanks are dropped, so an all-blank split comes back empty.
// `keepZeros` keeps a typed 0 (a target of none), which a holding's split has no use for.
function parseSplit(raw, { keepZeros = false } = {}) {
    const unknown = Object.keys(raw).find(key => !CLASS_KEYS.includes(key));

    if (unknown) {
        return { error: `Unknown asset class "${unknown}".` };
    }

    const entries = [];

    for (const key of CLASS_KEYS) {
        const typed = text(raw[key]);

        if (!typed) {
            continue;
        }

        const share = parseTypedNumber(typed);

        if (!isShare(share)) {
            return { error: 'Each share must be a number from 0 to 100.' };
        }

        if (share > 0 || keepZeros) {
            entries.push([key, share]);
        }
    }

    const split = Object.fromEntries(entries);
    const error = entries.length ? splitError(split) : null;

    return error ? { error } : { split };
}

/**
 * Sets a holding's split from typed shares; every share blank clears it.
 * @param {object} raw class key → typed share
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function setHoldingSplit(settings, holding, raw) {
    const name = text(holding);

    if (!name) {
        return fail('Unknown holding.');
    }

    const parsed = parseSplit(raw);

    if (parsed.error) {
        return fail(parsed.error);
    }

    const index = settings.holdings.findIndex(entry => sameName(entry.name, name));
    const kept = Object.keys(parsed.split).length > 0;

    if (index === -1 && kept) {
        settings.holdings.push({ name, split: parsed.split });
    } else if (kept) {
        settings.holdings[index].split = parsed.split;
    } else if (index !== -1) {
        settings.holdings.splice(index, 1);
    }

    return { ok: true };
}

/**
 * Sets the target allocation from typed shares. A blank class has no target and is left out of
 * the allocation percentages; 0 means you want none of it. Every share blank clears the targets.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function setTargets(settings, raw) {
    const parsed = parseSplit(raw, { keepZeros: true });

    if (parsed.error) {
        return fail(parsed.error);
    }

    settings.targets = parsed.split;

    return { ok: true };
}

/**
 * Reads a number typed by the user; commas are thousands separators.
 * @param {string} typed trimmed input
 * @returns {number} NaN when it isn't a plain number
 */
export function parseTypedNumber(typed) {
    const cleaned = typed.replace(/,/g, '');

    return /^-?(\d+\.?\d*|\.\d+)$/.test(cleaned) ? Number(cleaned) : NaN;
}

const isNumber = value => typeof value === 'number' && Number.isFinite(value);
/** @returns {boolean} whether `value` is a whole year from 1900 to 2100 */
export const isYear = value => Number.isInteger(value) && value >= 1900 && value <= 2100;
const optional = check => value => value === null || check(value);

// Per FIRE field: whether a stored value is valid, and the message when it isn't.
const FIRE_RULES = {
    swr: [value => isNumber(value) && value > 0 && value <= 100, 'Enter a number above 0 and up to 100.'],
    withdrawalTax: [value => isNumber(value) && value >= 0 && value < 100, 'Enter a number from 0 to below 100.'],
    nonRegTaxDrag: [value => isNumber(value) && value >= 0 && value < 100, 'Enter a number from 0 to below 100.'],
    expectedReturn: [isNumber, 'Enter a number.'],
    // −100% inflation would divide by zero in the projection.
    inflation: [value => isNumber(value) && value > -100, 'Enter a number above -100.'],
    retirementSpending: [optional(value => isNumber(value) && value >= 0), 'Enter an amount of 0 or more.'],
    birthYear: [optional(isYear), 'Enter a year from 1900 to 2100.'],
    projectionStart: [optional(isYear), 'Enter a year from 1900 to 2100.'],
    projectionEnd: [optional(isYear), 'Enter a year from 1900 to 2100.']
};

/**
 * Checks one stored FIRE input.
 * @returns {string|null} the problem, or null when valid
 */
export function fireFieldError(field, value) {
    const [valid, message] = FIRE_RULES[field];

    return valid(value) ? null : message;
}

/** @returns {string|null} the problem when the projection end year isn't after its start year */
export function projectionYearsError({ projectionStart, projectionEnd }) {
    return projectionStart !== null && projectionEnd !== null && projectionEnd <= projectionStart
        ? 'The projection end year must be after its start year.'
        : null;
}

/**
 * Sets one FIRE input from user input. Optional fields clear when blank.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function setFireInput(settings, field, raw) {
    if (!Object.hasOwn(FIRE_RULES, field)) {
        return fail(`Unknown setting "${field}".`);
    }

    const typed = text(raw);
    const value = typed ? parseTypedNumber(typed) : null;

    const error = fireFieldError(field, value) ?? projectionYearsError({ ...settings.fire, [field]: value });

    if (error) {
        return fail(error);
    }

    settings.fire[field] = value;

    return { ok: true };
}
