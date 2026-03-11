import { describe, it, expect } from 'vitest';
import tdParser from '../../js/parsers/td.js';

describe('td parser', () => {
    describe('contract', () => {
        it('has correct id and metadata', () => {
            expect(tdParser.id).toBe('td');
            expect(tdParser.account).toBe('TD');
            expect(tdParser.hasHeader).toBe(false);
        });
    });

    describe('detect', () => {
        it('returns true for any input (fallback parser)', () => {
            expect(tdParser.detect('some,random,header')).toBe(true);
        });
    });

    describe('parseLine', () => {
        it('parses amount out as expense', () => {
            const result = tdParser.parseLine('1/1/2025,TIM HORTONS,5.50,,1000.00');
            expect(result.type).toBe('expense');
            expect(result.amount).toBe(5.50);
            expect(result.account).toBe('TD');
        });

        it('parses amount in as income', () => {
            const result = tdParser.parseLine('1/1/2025,DIRECT DEPOSIT,,2000.00,3000.00');
            expect(result.type).toBe('income');
            expect(result.amount).toBe(2000);
        });

        it('returns null when no amount', () => {
            expect(tdParser.parseLine('1/1/2025,SOMETHING,,,')).toBeNull();
        });

        it('returns null for too few fields', () => {
            expect(tdParser.parseLine('1/1/2025,desc')).toBeNull();
        });

        it('returns null for invalid date', () => {
            expect(tdParser.parseLine('bad/date,TEST,5.50,,1000')).toBeNull();
        });
    });
});
