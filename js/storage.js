// The only LocalStorage reader/writer.
import { transactions, settings, balances, closedMonths, replaceAll } from './state.js';
import { emptySettings } from './settings.js';

const LEGACY_CATEGORIES_KEY = 'categories';

function read(key) {
    const raw = localStorage.getItem(key);

    return raw ? JSON.parse(raw) : null;
}

/** Loads all app data from LocalStorage into state; missing keys load as a fresh install. Never writes. */
export function loadData() {
    const savedTransactions = read('transactions') ?? [];
    const savedSettings = read('settings') ?? {};

    replaceAll({
        transactions: savedTransactions.map(t => ({ ...t, date: new Date(t.date) })),
        settings: { ...emptySettings(), ...savedSettings },
        balances: read('balances') ?? {},
        closedMonths: read('closedMonths') ?? []
    });
}

// Writes each [key, value] pair as JSON; alerts instead of throwing when storage is full or disabled.
function write(entries) {
    try {
        entries.forEach(([key, value]) => localStorage.setItem(key, JSON.stringify(value)));

        return true;
    } catch (e) {
        console.error('Failed to save data to localStorage:', e);
        alert('Could not save data. LocalStorage may be full or disabled.');

        return false;
    }
}

/**
 * Saves all app data to LocalStorage; alerts instead of throwing when storage is full or disabled.
 * @returns {boolean} whether everything was saved
 */
export function saveData() {
    return write([['transactions', transactions], ['settings', settings], ['balances', balances], ['closedMonths', closedMonths]]);
}

/**
 * Saves only balances and closed months, the data the Balance Sheet grid changes,
 * so an edit there doesn't rewrite every transaction.
 * @returns {boolean} whether both were saved
 */
export function saveBalanceSheet() {
    return write([['balances', balances], ['closedMonths', closedMonths]]);
}

/** Removes keys older versions wrote that the app no longer reads (called by Restore). */
export function clearLegacyKeys() {
    localStorage.removeItem(LEGACY_CATEGORIES_KEY);
}
