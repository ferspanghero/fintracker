// Pure Backup / Restore format: one JSON object with all app data. Restore is
// all-or-nothing, so validation collects every problem before anything changes.

import {
    CURRENCIES, RATE_CURRENCIES, SETTINGS_VERSION, ASSET_TYPES, CLASS_KEYS, FIRE_DEFAULTS,
    splitError, fireFieldError, projectionYearsError, migrateSettings, migrateFire
} from './settings.js';
import { roomEntriesErrors } from './registered-room.js';
import { UNCATEGORIZED } from './category-engine.js';
import { isMonthKey } from './balance-sheet.js';
import { EXPENSE, TRANSACTION_TYPES } from './constants.js';

export const BACKUP_APP = 'fintracker';
export const BACKUP_VERSION = 2;
// Older backups that still restore: backup version → the settings version it carries.
const SETTINGS_VERSION_OF = { 1: 1, [BACKUP_VERSION]: SETTINGS_VERSION };
const DETAIL_TEXT_FIELDS = ['institution', 'owner', 'holding'];

/**
 * Wraps all app data in the backup envelope. Dates serialize as ISO strings via JSON.
 * @param {{settings: object, transactions: object[], balances: object, closedMonths: string[], registeredRoom: object[]}} state
 * @param {Date} now
 * @returns {object}
 */
export function buildBackup({ settings, transactions, balances, closedMonths, registeredRoom }, now) {
    return {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt: now.toISOString(),
        settings,
        transactions,
        balances,
        closedMonths,
        registeredRoom
    };
}

/** @returns {string} the download name for a backup made on `now`'s local date */
export function backupFileName(now) {
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return `fintracker-backup-${day}.json`;
}

const isObject = value => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonEmptyString = value => typeof value === 'string' && value.trim() !== '';
const capitalized = type => (type === EXPENSE ? 'Expense' : 'Income');

function checkRates(rates, errors) {
    if (!isObject(rates)) {
        errors.push('Rates are missing.');

        return;
    }

    RATE_CURRENCIES.forEach(currency => {
        const value = rates[currency];

        if (value !== null && !(typeof value === 'number' && Number.isFinite(value) && value > 0)) {
            errors.push(`${currency} rate must be a positive number or empty.`);
        }
    });

    if (rates.date !== null && typeof rates.date !== 'string') {
        errors.push('Rate date must be text or empty.');
    }

    if (rates.refreshedAt !== null && Number.isNaN(new Date(rates.refreshedAt).getTime())) {
        errors.push('Rate refresh time must be a date or empty.');
    }
}

// Returns whether the category lists are usable for checking transactions.
function checkCategories(categories, errors) {
    let usable = true;

    TRANSACTION_TYPES.forEach(type => {
        const list = categories?.[type];
        const label = `${capitalized(type)} categories`;

        if (!Array.isArray(list)) {
            errors.push(`${label} must be a list.`);
            usable = false;

            return;
        }

        const seen = new Set();

        list.forEach(name => {
            if (!isNonEmptyString(name)) {
                errors.push(`${label} contain an empty name.`);

                return;
            }

            const lower = name.toLowerCase();

            if (seen.has(lower)) {
                errors.push(`${label} contain "${name}" more than once.`);
            }

            seen.add(lower);
        });

        if (!list.includes(UNCATEGORIZED)) {
            errors.push(`${label} must include "${UNCATEGORIZED}".`);
        }
    });

    return usable;
}

// `withDetails` adds the version 2 asset fields (type, institution, owner, holding).
function checkAssets(assets, errors, withDetails) {
    if (!Array.isArray(assets)) {
        errors.push('Assets must be a list.');

        return new Set();
    }

    const ids = new Set();
    const names = new Set();

    assets.forEach((asset, i) => {
        const where = `Asset ${i + 1}`;

        if (!isNonEmptyString(asset?.id)) {
            errors.push(`${where}: id is missing.`);
        } else if (ids.has(asset.id)) {
            errors.push(`${where}: id "${asset.id}" is used more than once.`);
        } else {
            ids.add(asset.id);
        }

        if (!isNonEmptyString(asset?.name)) {
            errors.push(`${where}: name is missing.`);
        } else if (names.has(asset.name.toLowerCase())) {
            errors.push(`${where}: name "${asset.name}" is used more than once.`);
        } else {
            names.add(asset.name.toLowerCase());
        }

        if (!CURRENCIES.includes(asset?.currency)) {
            errors.push(`${where}: unsupported currency "${asset?.currency}".`);
        }

        if (typeof asset?.archived !== 'boolean') {
            errors.push(`${where}: archived must be true or false.`);
        }

        if (withDetails) {
            checkAssetDetails(asset, where, errors);
        }
    });

    return ids;
}

function checkAssetDetails(asset, where, errors) {
    if (asset?.type !== null && !ASSET_TYPES.some(type => type.name === asset?.type)) {
        errors.push(`${where}: unknown type "${asset?.type}".`);
    }

    DETAIL_TEXT_FIELDS.filter(field => typeof asset?.[field] !== 'string').forEach(field => errors.push(`${where}: ${field} must be text.`));
}

function checkHoldings(holdings, errors) {
    if (!Array.isArray(holdings)) {
        errors.push('Holdings must be a list.');

        return;
    }

    const names = new Set();

    holdings.forEach((holding, i) => {
        const where = `Holding ${i + 1}`;

        if (!isObject(holding)) {
            errors.push(`${where}: must be an object.`);

            return;
        }

        if (!isNonEmptyString(holding.name)) {
            errors.push(`${where}: name is missing.`);
        } else if (names.has(holding.name.toLowerCase())) {
            errors.push(`${where}: "${holding.name}" appears more than once.`);
        } else {
            names.add(holding.name.toLowerCase());
        }

        const error = splitError(holding.split);

        if (error) {
            errors.push(`${where}: ${error}`);
        }
    });
}

function checkTargets(targets, errors) {
    const error = isObject(targets) && !Object.keys(targets).length ? null : splitError(targets);

    if (error) {
        errors.push(`Targets: ${error}`);
    }
}

// FIRE inputs saved while v4 was in development may carry a spending mode and fixed amount instead of the override.
const withSpendingOverride = fire => (Object.hasOwn(fire, 'retirementSpending')
    ? fire
    : { ...fire, retirementSpending: migrateFire(fire).retirementSpending });

function checkFire(stored, errors) {
    if (!isObject(stored)) {
        errors.push('FIRE settings are missing.');

        return;
    }

    const fire = withSpendingOverride(stored);

    Object.keys(FIRE_DEFAULTS).forEach(field => {
        const error = fireFieldError(field, fire[field]);

        if (error) {
            errors.push(`FIRE ${field}: ${error}`);
        }
    });

    const yearsError = projectionYearsError(fire);

    if (yearsError) {
        errors.push(`FIRE: ${yearsError}`);
    }
}

function checkTransactions(transactions, categories, errors) {
    if (!Array.isArray(transactions)) {
        errors.push('Transactions must be a list.');

        return;
    }

    transactions.forEach((t, i) => {
        const where = `Transaction ${i + 1}`;

        if (typeof t?.date !== 'string' || Number.isNaN(new Date(t.date).getTime())) {
            errors.push(`${where}: invalid date.`);
        }

        if (!isNonEmptyString(t?.description)) {
            errors.push(`${where}: description is missing.`);
        }

        if (typeof t?.amount !== 'number' || !Number.isFinite(t.amount)) {
            errors.push(`${where}: amount must be a number.`);
        }

        if (!TRANSACTION_TYPES.includes(t?.type)) {
            errors.push(`${where}: type must be income or expense.`);
        } else if (categories && !categories[t.type].includes(t.category)) {
            errors.push(`${where}: category "${t.category}" is not in the ${t.type} categories.`);
        }

        if (typeof t?.account !== 'string') {
            errors.push(`${where}: account must be text.`);
        }
    });
}

function checkBalances(balances, assetIds, errors) {
    if (!isObject(balances)) {
        errors.push('Balances must be an object.');

        return;
    }

    const keys = Object.keys(balances);
    keys.filter(key => !isMonthKey(key)).forEach(key => errors.push(`Balances: invalid month "${key}".`));

    keys.filter(isMonthKey).forEach(key => {
        const month = balances[key];

        if (!isObject(month)) {
            errors.push(`Balances ${key}: must be an object.`);

            return;
        }

        Object.entries(month).forEach(([id, value]) => {
            if (!assetIds.has(id)) {
                errors.push(`Balances ${key}: unknown asset "${id}".`);
            } else if (typeof value !== 'number' || !Number.isFinite(value)) {
                errors.push(`Balances ${key}: value for "${id}" must be a number.`);
            }
        });
    });
}

function checkClosedMonths(closedMonths, errors) {
    if (!Array.isArray(closedMonths)) {
        errors.push('Closed months must be a list.');

        return;
    }

    const seen = new Set();

    closedMonths.forEach(key => {
        if (!isMonthKey(key)) {
            errors.push(`Closed months: invalid month "${key}".`);
        } else if (seen.has(key)) {
            errors.push(`Closed months: "${key}" appears more than once.`);
        }

        seen.add(key);
    });
}

// Settings are rebuilt from known fields only, so nothing else in the file (e.g. a "__proto__" key) reaches app state.
const pick = (source, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(source, key)).map(key => [key, source[key]]));

function rebuildVersionOneSettings(settings) {
    return {
        version: settings.version,
        rates: { USD: settings.rates.USD, BRL: settings.rates.BRL, date: settings.rates.date, refreshedAt: settings.rates.refreshedAt },
        categories: { expense: [...settings.categories.expense], income: [...settings.categories.income] },
        assets: settings.assets.map(({ id, name, currency, archived }) => ({ id, name, currency, archived }))
    };
}

function rebuildSettings(settings) {
    return {
        ...rebuildVersionOneSettings(settings),
        assets: settings.assets.map(({ id, name, currency, archived, type, institution, owner, holding }) =>
            ({ id, name, currency, archived, type, institution, owner, holding })),
        holdings: settings.holdings.map(({ name, split }) => ({ name, split: pick(split, CLASS_KEYS) })),
        targets: pick(settings.targets, CLASS_KEYS),
        fire: migrateFire(settings.fire)
    };
}

/**
 * Checks a parsed backup file.
 * A version 1 backup is accepted and its settings migrated; it carries no registered room.
 * @param {unknown} backup
 * @returns {{ok: true, errors: [], data: object} | {ok: false, errors: string[]}} `data` holds settings,
 *          transactions (with Date objects), balances, closedMonths and registeredRoom ready for replaceAll
 */
export function validateBackup(backup) {
    if (!isObject(backup) || backup.app !== BACKUP_APP) {
        return { ok: false, errors: ['Not a FinTracker backup.'] };
    }

    if (!Object.hasOwn(SETTINGS_VERSION_OF, backup.version)) {
        return { ok: false, errors: [`Unsupported backup version ${backup.version}.`] };
    }

    const current = backup.version === BACKUP_VERSION;

    const errors = [];
    const { settings } = backup;
    let categoriesUsable = false;
    let assetIds = new Set();

    if (!isObject(settings)) {
        errors.push('Settings are missing.');
    } else {
        if (settings.version !== SETTINGS_VERSION_OF[backup.version]) {
            errors.push(`Unsupported settings version ${settings.version}.`);
        }

        checkRates(settings.rates, errors);
        categoriesUsable = checkCategories(settings.categories, errors);
        assetIds = checkAssets(settings.assets, errors, current);

        if (current) {
            checkHoldings(settings.holdings, errors);
            checkTargets(settings.targets, errors);
            checkFire(settings.fire, errors);
        }
    }

    checkTransactions(backup.transactions, categoriesUsable ? settings.categories : null, errors);
    checkBalances(backup.balances, assetIds, errors);
    checkClosedMonths(backup.closedMonths, errors);

    if (current) {
        errors.push(...roomEntriesErrors(backup.registeredRoom));
    }

    if (errors.length) {
        return { ok: false, errors };
    }

    return {
        ok: true,
        errors: [],
        data: {
            settings: current ? rebuildSettings(settings) : migrateSettings(rebuildVersionOneSettings(settings)),
            transactions: backup.transactions.map(t => ({ ...t, date: new Date(t.date) })),
            balances: backup.balances,
            closedMonths: backup.closedMonths,
            registeredRoom: current
                ? backup.registeredRoom.map(({ year, account, person, room, contributed }) => ({ year, account, person, room, contributed }))
                : []
        }
    };
}

const counted = (count, word) => `${count.toLocaleString('en-CA')} ${word}${count === 1 ? '' : 's'}`;

/** @returns {string} the restore confirmation summary for validated backup data */
export function describeBackup({ transactions, settings, balances, registeredRoom = [] }) {
    const months = counted(Object.keys(balances).length, 'month');
    const room = registeredRoom.length
        ? `, ${registeredRoom.length.toLocaleString('en-CA')} registered room ${registeredRoom.length === 1 ? 'entry' : 'entries'}`
        : '';

    return `${counted(transactions.length, 'transaction')}, ${counted(settings.assets.length, 'asset')}, ${months} of balances${room}. This replaces all current data.`;
}
