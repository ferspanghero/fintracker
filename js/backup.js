// Pure Backup / Restore format: one JSON object with all app data. Restore is
// all-or-nothing, so validation collects every problem before anything changes.

import { CURRENCIES, RATE_CURRENCIES, SETTINGS_VERSION } from './settings.js';
import { UNCATEGORIZED } from './category-engine.js';
import { isMonthKey } from './balance-sheet.js';

export const BACKUP_APP = 'fintracker';
export const BACKUP_VERSION = 1;

/**
 * Wraps all app data in the backup envelope. Dates serialize as ISO strings via JSON.
 * @param {{settings: object, transactions: object[], balances: object, closedMonths: string[]}} state
 * @param {Date} now
 * @returns {object}
 */
export function buildBackup({ settings, transactions, balances, closedMonths }, now) {
    return {
        app: BACKUP_APP,
        version: BACKUP_VERSION,
        exportedAt: now.toISOString(),
        settings,
        transactions,
        balances,
        closedMonths
    };
}

/** @returns {string} the download name for a backup made on `now`'s local date */
export function backupFileName(now) {
    const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    return `fintracker-backup-${day}.json`;
}

const isObject = value => typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonEmptyString = value => typeof value === 'string' && value.trim() !== '';
const capitalized = type => (type === 'expense' ? 'Expense' : 'Income');

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

    ['expense', 'income'].forEach(type => {
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

function checkAssets(assets, errors) {
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
    });

    return ids;
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

        if (t?.type !== 'income' && t?.type !== 'expense') {
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

/**
 * Checks a parsed backup file.
 * @param {unknown} backup
 * @returns {{ok: true, errors: [], data: object} | {ok: false, errors: string[]}} `data` holds
 *          settings, transactions (with Date objects), balances and closedMonths ready for replaceAll
 */
export function validateBackup(backup) {
    if (!isObject(backup) || backup.app !== BACKUP_APP) {
        return { ok: false, errors: ['Not a FinTracker backup.'] };
    }

    if (backup.version !== BACKUP_VERSION) {
        return { ok: false, errors: [`Unsupported backup version ${backup.version}.`] };
    }

    const errors = [];
    const { settings } = backup;
    let categoriesUsable = false;
    let assetIds = new Set();

    if (!isObject(settings)) {
        errors.push('Settings are missing.');
    } else {
        if (settings.version !== SETTINGS_VERSION) {
            errors.push(`Unsupported settings version ${settings.version}.`);
        }

        checkRates(settings.rates, errors);
        categoriesUsable = checkCategories(settings.categories, errors);
        assetIds = checkAssets(settings.assets, errors);
    }

    checkTransactions(backup.transactions, categoriesUsable ? settings.categories : null, errors);
    checkBalances(backup.balances, assetIds, errors);
    checkClosedMonths(backup.closedMonths, errors);

    if (errors.length) {
        return { ok: false, errors };
    }

    return {
        ok: true,
        errors: [],
        data: {
            // Rebuilt from known fields so nothing else in the file (e.g. a "__proto__" key) reaches app state.
            settings: {
                version: settings.version,
                rates: { USD: settings.rates.USD, BRL: settings.rates.BRL, date: settings.rates.date, refreshedAt: settings.rates.refreshedAt },
                categories: { expense: [...settings.categories.expense], income: [...settings.categories.income] },
                assets: settings.assets.map(({ id, name, currency, archived }) => ({ id, name, currency, archived }))
            },
            transactions: backup.transactions.map(t => ({ ...t, date: new Date(t.date) })),
            balances: backup.balances,
            closedMonths: backup.closedMonths
        }
    };
}

const counted = (count, word) => `${count.toLocaleString('en-CA')} ${word}${count === 1 ? '' : 's'}`;

/** @returns {string} the restore confirmation summary for validated backup data */
export function describeBackup({ transactions, settings, balances }) {
    const months = counted(Object.keys(balances).length, 'month');

    return `${counted(transactions.length, 'transaction')}, ${counted(settings.assets.length, 'asset')}, ${months} of balances. This replaces all current data.`;
}
