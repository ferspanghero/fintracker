import { emptySettings } from './settings.js';

// The single in-memory copy of app data. Importers hold these references, so
// every update mutates them in place instead of reassigning.
export const transactions = [];
export const settings = emptySettings();
export const balances = {};
export const closedMonths = [];
// RRSP/TFSA room entries: { year, account, person, room, contributed } (see registered-room.js).
export const registeredRoom = [];

export const currentSort = { field: 'date', direction: 'asc' };
export const currentFilter = { dateRange: 'all', startDate: null, endDate: null, category: 'all', textFilter: '' };

function replaceObject(target, source) {
    Object.keys(target).forEach(key => delete target[key]);
    Object.assign(target, structuredClone(source));
}

/**
 * Replaces all app data in place (used by load and Restore).
 * Transactions are taken as given; settings, balances and room entries are deep-copied.
 * @param {{transactions: object[], settings: object, balances: object, closedMonths: string[], registeredRoom?: object[]}} data
 */
export function replaceAll(data) {
    transactions.length = 0;
    data.transactions.forEach(t => transactions.push(t));
    replaceObject(settings, data.settings);
    replaceObject(balances, data.balances);
    closedMonths.length = 0;
    closedMonths.push(...data.closedMonths);
    registeredRoom.length = 0;
    registeredRoom.push(...structuredClone(data.registeredRoom ?? []));
}
