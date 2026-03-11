import { describe, it, expect } from 'vitest';
import simpliiParser from '../../js/parsers/simplii.js';

describe('simplii parser', () => {
    describe('contract', () => {
        it('has correct id and metadata', () => {
            expect(simpliiParser.id).toBe('simplii');
            expect(simpliiParser.account).toBe('Simplii');
            expect(simpliiParser.hasHeader).toBe(true);
        });
    });

    describe('detect', () => {
        it('detects simplii header', () => {
            expect(simpliiParser.detect('date, transaction details, funds out, funds in')).toBe(true);
        });

        it('rejects unrelated header', () => {
            expect(simpliiParser.detect('some,random,header')).toBe(false);
        });
    });

    describe('parseLine', () => {
        it('parses funds out as expense', () => {
            const result = simpliiParser.parseLine('2/5/2025, GROCERY STORE, 50.00, ');
            expect(result.type).toBe('expense');
            expect(result.amount).toBe(50);
            expect(result.account).toBe('Simplii');
        });

        it('parses funds in as income', () => {
            const result = simpliiParser.parseLine('2/5/2025, DEPOSIT, , 1000.00');
            expect(result.type).toBe('income');
            expect(result.amount).toBe(1000);
        });

        it('returns null for too few fields', () => {
            expect(simpliiParser.parseLine('2/5/2025, desc')).toBeNull();
        });

        it('returns null for invalid date', () => {
            expect(simpliiParser.parseLine('bad/date, STORE, 50.00, ')).toBeNull();
        });
    });
});
