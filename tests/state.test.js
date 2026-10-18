import { describe, it, expect } from 'vitest';
import { transactions, settings, balances, closedMonths, registeredRoom, replaceAll } from '../js/state.js';
import { emptySettings } from '../js/settings.js';

describe('replaceAll', () => {
    it('replaces every collection in place, keeping the exported references', () => {
        // Arrange
        transactions.push({ description: 'old' });
        balances['2025-01'] = { a: 1 };
        closedMonths.push('2025-01');
        const refs = [transactions, settings, balances, closedMonths];
        const nextSettings = { ...emptySettings(), assets: [{ id: 'b', name: 'B', currency: 'USD', archived: true }] };

        // Act
        replaceAll({
            transactions: [{ description: 'new' }],
            settings: nextSettings,
            balances: { '2026-02': { b: 2 } },
            closedMonths: ['2026-02']
        });

        // Assert
        expect([transactions, settings, balances, closedMonths]).toEqual(refs);
        expect(refs[0]).toBe(transactions);
        expect(transactions).toEqual([{ description: 'new' }]);
        expect(settings).toEqual(nextSettings);
        expect(balances).toEqual({ '2026-02': { b: 2 } });
        expect(closedMonths).toEqual(['2026-02']);
    });

    it('does not alias the settings and balances it was given', () => {
        // Arrange
        const nextSettings = emptySettings();
        const nextBalances = { '2026-02': { b: 2 } };

        // Act
        replaceAll({ transactions: [], settings: nextSettings, balances: nextBalances, closedMonths: [] });
        nextSettings.assets.push({ id: 'x' });
        nextBalances['2026-02'].b = 99;

        // Assert
        expect(settings.assets).toEqual([]);
        expect(balances['2026-02'].b).toBe(2);
    });

    it('drops keys absent from the new data', () => {
        // Arrange
        settings.extra = true;
        balances['2025-05'] = {};

        // Act
        replaceAll({ transactions: [], settings: emptySettings(), balances: {}, closedMonths: [] });

        // Assert
        expect(settings).not.toHaveProperty('extra');
        expect(balances).toEqual({});
    });
});

describe('replaceAll registered room', () => {
    it('replaces the registered room in place with a copy', () => {
        // Arrange
        const ref = registeredRoom;
        const next = [{ year: 2026, account: 'RRSP', person: 'Alex', room: 100, contributed: null }];

        // Act
        replaceAll({ transactions: [], settings: emptySettings(), balances: {}, closedMonths: [], registeredRoom: next });
        next[0].room = 5;

        // Assert
        expect(registeredRoom).toBe(ref);
        expect(registeredRoom).toEqual([{ year: 2026, account: 'RRSP', person: 'Alex', room: 100, contributed: null }]);
    });

    it('empties the registered room when the data has none', () => {
        // Arrange
        registeredRoom.push({ year: 2026, account: 'RRSP', person: 'Alex', room: 1, contributed: 1 });

        // Act
        replaceAll({ transactions: [], settings: emptySettings(), balances: {}, closedMonths: [] });

        // Assert
        expect(registeredRoom).toEqual([]);
    });
});
