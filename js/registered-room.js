// Pure rules for RRSP / TFSA contribution room: one entry per year, account and
// person, holding the room you may contribute and what you contributed (CAD).
// Entries live in a list, so person names are never used as object keys.

import { ASSET_TYPES, parseTypedNumber, sameName, isYear } from './settings.js';

export const ROOM_ACCOUNTS = ['RRSP', 'TFSA'];
// CRA tolerates this much RRSP over-contribution before charging 1% a month; TFSA has no allowance.
export const RRSP_ALLOWANCE = 2000;

const ROOM_FIELDS = ['room', 'contributed'];
const JOINT = 'joint';

const fail = error => ({ ok: false, error });
const isAmount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function addDistinct(names, name) {
    if (name && !names.some(existing => sameName(existing, name))) {
        names.push(name);
    }
}

/**
 * People who hold an active account of `account`'s room type, in asset order; "Joint" is left out.
 * @returns {string[]}
 */
export function roomPeople(settings, account) {
    const types = ASSET_TYPES.filter(type => type.room === account).map(type => type.name);
    const people = [];

    settings.assets
        .filter(asset => !asset.archived && types.includes(asset.type) && asset.owner.toLowerCase() !== JOINT)
        .forEach(asset => addDistinct(people, asset.owner));

    return people;
}

const findEntry = (entries, year, account, person) =>
    entries.find(e => e.year === year && e.account === account && sameName(e.person, person));

function warningFor(account, left) {
    if (left === null || left >= 0) {
        return null;
    }

    const amount = -left;
    const penalized = account === 'TFSA' || amount > RRSP_ALLOWANCE;

    return { kind: penalized ? 'penalty' : 'over', amount };
}

/**
 * The room table for one year: for each account, everyone from roomPeople plus anyone with an entry that year.
 * Left = room − contributed, empty until the room is entered.
 * @returns {{account: string, person: string, room: number|null, contributed: number|null,
 *            left: number|null, warning: {kind: 'over'|'penalty', amount: number}|null}[]}
 */
export function roomRows(entries, settings, year) {
    return ROOM_ACCOUNTS.flatMap(account => {
        const people = roomPeople(settings, account);
        entries.filter(e => e.year === year && e.account === account).forEach(e => addDistinct(people, e.person));

        return people.map(person => {
            const found = findEntry(entries, year, account, person);
            const room = found?.room ?? null;
            const contributed = found?.contributed ?? null;
            const left = room === null ? null : room - (contributed ?? 0);

            return { account, person, room, contributed, left, warning: warningFor(account, left) };
        });
    });
}

/**
 * Sets one room or contributed value from user input. Blank clears it; an entry with both cleared is removed.
 * @param {object[]} entries the room entries, changed in place on success
 * @param {{year: number, account: string, person: string, field: 'room'|'contributed'}} target
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function setRoomValue(entries, { year, account, person, field }, raw) {
    if (!ROOM_FIELDS.includes(field)) {
        return fail(`Unknown field "${field}".`);
    }

    if (!ROOM_ACCOUNTS.includes(account)) {
        return fail(`Unknown account "${account}".`);
    }

    const name = String(person ?? '').trim();

    if (!name) {
        return fail('Unknown person.');
    }

    if (!isYear(year)) {
        return fail('Unknown year.');
    }

    const typed = String(raw ?? '').trim();
    const value = typed ? parseTypedNumber(typed) : null;

    if (value !== null && !isAmount(value)) {
        return fail('Enter an amount of 0 or more.');
    }

    let found = findEntry(entries, year, account, name);

    if (!found) {
        if (value === null) {
            return { ok: true };
        }

        found = { year, account, person: name, room: null, contributed: null };
        entries.push(found);
    }

    found[field] = value;

    if (found.room === null && found.contributed === null) {
        entries.splice(entries.indexOf(found), 1);
    }

    return { ok: true };
}

/**
 * Years the room table offers: every year with entries plus the current year, newest first.
 * @returns {number[]}
 */
export function roomYears(entries, today) {
    return [...new Set([today.getFullYear(), ...entries.map(e => e.year)])].sort((a, b) => b - a);
}

/**
 * Checks stored room entries (e.g. from a backup).
 * @returns {string[]} every problem found; empty when valid
 */
export function roomEntriesErrors(entries) {
    if (!Array.isArray(entries)) {
        return ['Registered room must be a list.'];
    }

    const errors = [];
    const seen = [];

    entries.forEach((e, i) => {
        const where = `Registered room ${i + 1}`;

        if (typeof e !== 'object' || e === null || Array.isArray(e)) {
            errors.push(`${where}: must be an object.`);

            return;
        }

        if (!isYear(e.year)) {
            errors.push(`${where}: year must be a whole number from 1900 to 2100.`);
        }

        if (!ROOM_ACCOUNTS.includes(e.account)) {
            errors.push(`${where}: unknown account "${e.account}".`);
        }

        const hasPerson = typeof e.person === 'string' && e.person.trim() !== '';

        if (!hasPerson) {
            errors.push(`${where}: person is missing.`);
        }

        ROOM_FIELDS.forEach(field => {
            if (e[field] !== null && !isAmount(e[field])) {
                errors.push(`${where}: ${field} must be an amount of 0 or more, or empty.`);
            }
        });

        if (hasPerson && seen.some(s => s.year === e.year && s.account === e.account && sameName(s.person, e.person))) {
            errors.push(`${where}: ${e.account} ${e.year} for "${e.person}" appears more than once.`);
        }

        if (hasPerson) {
            seen.push(e);
        }
    });

    return errors;
}
