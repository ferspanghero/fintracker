import { describe, it, expect } from 'vitest';
import {
    ROOM_ACCOUNTS, RRSP_ALLOWANCE, roomPeople, roomRows, setRoomValue, roomYears, roomEntriesErrors
} from '../js/registered-room.js';
import { emptySettings, addAsset } from '../js/settings.js';

function settingsWith(...assets) {
    const settings = emptySettings();
    let id = 0;
    assets.forEach(([type, owner, archived = false]) => {
        const result = addAsset(settings, 'n', 'CAD', () => `a${++id}`, { type, owner, holding: `H${id}` });
        result.asset.archived = archived;
    });

    return settings;
}

const entry = (account, person, room, contributed, year = 2026) => ({ year, account, person, room, contributed });

describe('roomPeople', () => {
    it('lists owners of active accounts with that room, without Joint or blanks, ignoring case', () => {
        // Arrange
        const settings = settingsWith(
            ['RRSP', 'Alex'], ['RRSP/DPSP', 'alex'], ['RRSP', 'Sam'], ['RRSP', 'Joint'], ['RRSP', ''],
            ['RRSP', 'Old', true], ['TFSA', 'Sam'], ['Non-registered', 'Pat'], ['Spousal RRSP', 'Kim']
        );

        // Act, Assert
        expect(ROOM_ACCOUNTS).toEqual(['RRSP', 'TFSA']);
        // A spousal RRSP's owner gets no row: contributions count against the contributor, entered under their name.
        expect(roomPeople(settings, 'RRSP')).toEqual(['Alex', 'Sam']);
        expect(roomPeople(settings, 'TFSA')).toEqual(['Sam']);
    });
});

describe('roomRows', () => {
    it('gives one row per account and person with what is left', () => {
        // Arrange
        const settings = settingsWith(['RRSP', 'Alex'], ['TFSA', 'Alex']);
        const entries = [entry('RRSP', 'alex', 30000, 24000), entry('TFSA', 'Alex', 7000, null)];

        // Act
        const rows = roomRows(entries, settings, 2026);

        // Assert
        expect(rows).toEqual([
            { account: 'RRSP', person: 'Alex', room: 30000, contributed: 24000, left: 6000, warning: null },
            { account: 'TFSA', person: 'Alex', room: 7000, contributed: null, left: 7000, warning: null }
        ]);
    });

    it('leaves Left empty until the room is entered', () => {
        // Arrange
        const settings = settingsWith(['TFSA', 'Sam']);

        // Act, Assert
        expect(roomRows([entry('TFSA', 'Sam', null, 500)], settings, 2026)[0]).toMatchObject({ left: null, warning: null });
        expect(roomRows([], settings, 2026)[0]).toMatchObject({ room: null, contributed: null, left: null });
    });

    it('keeps rows for people who only appear in that year\'s entries', () => {
        // Arrange
        const settings = settingsWith(['TFSA', 'Sam']);

        // Act
        const rows = roomRows([entry('TFSA', 'Pat', 100, 0), entry('TFSA', 'Kim', 5, 0, 2025)], settings, 2026);

        // Assert
        expect(rows.map(r => r.person)).toEqual(['Sam', 'Pat']);
    });

    it.each([
        ['RRSP', 1000, 1000, null],
        ['RRSP', 1000, 2500, { kind: 'over', amount: 1500 }],
        ['RRSP', 1000, 1000 + RRSP_ALLOWANCE, { kind: 'over', amount: 2000 }],
        ['RRSP', 1000, 3001, { kind: 'penalty', amount: 2001 }],
        ['TFSA', 1000, 1100, { kind: 'penalty', amount: 100 }]
    ])('%s room %d with %d contributed warns %j', (account, room, contributed, warning) => {
        // Arrange
        const settings = settingsWith([account, 'Sam']);

        // Act
        const [row] = roomRows([entry(account, 'Sam', room, contributed)], settings, 2026);

        // Assert
        expect(row.warning).toEqual(warning);
    });
});

describe('setRoomValue', () => {
    const target = { year: 2026, account: 'RRSP', person: 'Alex' };

    it('adds an entry for a new person and year', () => {
        // Arrange
        const entries = [];

        // Act
        const result = setRoomValue(entries, { ...target, field: 'room' }, '30,000');

        // Assert
        expect(result).toEqual({ ok: true });
        expect(entries).toEqual([entry('RRSP', 'Alex', 30000, null)]);
    });

    it('updates the matching entry ignoring the person\'s case', () => {
        // Arrange
        const entries = [entry('RRSP', 'Alex', 30000, null)];

        // Act
        setRoomValue(entries, { ...target, person: 'ALEX', field: 'contributed' }, '1500.5');

        // Assert
        expect(entries).toEqual([entry('RRSP', 'Alex', 30000, 1500.5)]);
    });

    it('removes the entry once both values are cleared', () => {
        // Arrange
        const entries = [entry('RRSP', 'Alex', 30000, null), entry('RRSP', 'Alex', 1, 1, 2025)];

        // Act
        setRoomValue(entries, { ...target, field: 'room' }, ' ');

        // Assert
        expect(entries).toEqual([entry('RRSP', 'Alex', 1, 1, 2025)]);
    });

    it('accepts clearing a value that was never entered', () => {
        // Arrange
        const entries = [];

        // Act, Assert
        expect(setRoomValue(entries, { ...target, field: 'room' }, '')).toEqual({ ok: true });
        expect(entries).toEqual([]);
    });

    it.each([
        [{ field: 'room' }, '-1', 'Enter an amount of 0 or more.'],
        [{ field: 'room' }, 'abc', 'Enter an amount of 0 or more.'],
        [{ field: 'left' }, '1', 'Unknown field "left".'],
        [{ field: 'room', account: 'RESP' }, '1', 'Unknown account "RESP".'],
        [{ field: 'room', person: ' ' }, '1', 'Unknown person.'],
        [{ field: 'room', year: 26.5 }, '1', 'Unknown year.']
    ])('rejects %j = %j', (change, raw, error) => {
        // Arrange
        const entries = [];

        // Act
        const result = setRoomValue(entries, { ...target, ...change }, raw);

        // Assert
        expect(result).toEqual({ ok: false, error });
        expect(entries).toEqual([]);
    });
});

describe('roomYears', () => {
    it('offers the years with entries plus the current year, newest first', () => {
        // Arrange
        const entries = [entry('RRSP', 'A', 1, 1, 2024), entry('TFSA', 'A', 1, 1, 2027), entry('TFSA', 'B', 1, 1, 2024)];

        // Act, Assert
        expect(roomYears(entries, new Date(2026, 5, 1))).toEqual([2027, 2026, 2024]);
    });
});

describe('roomEntriesErrors', () => {
    it('accepts valid entries', () => {
        // Act, Assert
        expect(roomEntriesErrors([entry('RRSP', 'Alex', 1, null), entry('TFSA', 'Alex', null, 0)])).toEqual([]);
    });

    it('rejects anything but a list', () => {
        // Act, Assert
        expect(roomEntriesErrors({})).toEqual(['Registered room must be a list.']);
    });

    it('reports a missing person instead of failing when a later entry shares its year and account', () => {
        // Arrange
        const entries = [{ year: 2026, account: 'TFSA', person: 5, room: 1, contributed: null }, entry('TFSA', 'Sam', 1, 1)];

        // Act, Assert
        expect(roomEntriesErrors(entries)).toEqual(['Registered room 1: person is missing.']);
    });

    it('lists every problem with its entry number', () => {
        // Arrange
        const entries = [
            { year: '26', account: 'RESP', person: '', room: -1, contributed: 'x' },
            entry('TFSA', 'Sam', 1, 1),
            entry('TFSA', 'sam', 2, 2),
            null
        ];

        // Act, Assert
        expect(roomEntriesErrors(entries)).toEqual([
            'Registered room 1: year must be a whole number from 1900 to 2100.',
            'Registered room 1: unknown account "RESP".',
            'Registered room 1: person is missing.',
            'Registered room 1: room must be an amount of 0 or more, or empty.',
            'Registered room 1: contributed must be an amount of 0 or more, or empty.',
            'Registered room 3: TFSA 2026 for "sam" appears more than once.',
            'Registered room 4: must be an object.'
        ]);
    });
});
