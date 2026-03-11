import { describe, it, expect } from 'vitest';
import amexParser from '../../js/parsers/amex.js';

describe('amex parser', () => {
    describe('contract', () => {
        it('has correct id and metadata', () => {
            expect(amexParser.id).toBe('amex');
            expect(amexParser.account).toBe('Amex');
            expect(amexParser.hasHeader).toBe(true);
        });
    });

    describe('detect', () => {
        it('detects amex header', () => {
            expect(amexParser.detect('date,date processed,description,amount')).toBe(true);
        });

        it('rejects unrelated header', () => {
            expect(amexParser.detect('some,random,header')).toBe(false);
        });
    });

    describe('parseDate', () => {
        it('parses DD MMM YYYY format', () => {
            const d = amexParser.parseDate('28 Feb 2025');
            expect(d.getFullYear()).toBe(2025);
            expect(d.getMonth()).toBe(1);
            expect(d.getDate()).toBe(28);
        });

        it('returns null for invalid date', () => {
            expect(amexParser.parseDate('99 Xyz 2025')).toBeNull();
        });
    });

    describe('parseLine', () => {
        it('parses positive amount as expense', () => {
            const result = amexParser.parseLine('28 Feb 2025,28 Feb 2025,STARBUCKS COFFEE,12.50');
            expect(result.type).toBe('expense');
            expect(result.amount).toBe(12.50);
            expect(result.account).toBe('Amex');
            expect(result.description).toBe('STARBUCKS COFFEE');
        });

        it('parses negative amount as income', () => {
            const result = amexParser.parseLine('28 Feb 2025,28 Feb 2025,PAYMENT RECEIVED,-500.00');
            expect(result.type).toBe('income');
            expect(result.amount).toBe(500);
        });

        it('returns null for too few fields', () => {
            expect(amexParser.parseLine('28 Feb 2025,desc')).toBeNull();
        });

        it('returns null for invalid date', () => {
            expect(amexParser.parseLine('99 Xyz 2025,99 Xyz 2025,TEST,10')).toBeNull();
        });

        it('does not set category (orchestrator responsibility)', () => {
            const result = amexParser.parseLine('28 Feb 2025,28 Feb 2025,NETFLIX,15.00');
            expect(result.category).toBeUndefined();
        });
    });
});
