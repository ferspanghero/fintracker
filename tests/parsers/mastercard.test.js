import { describe, it, expect } from 'vitest';
import mastercardParser from '../../js/parsers/mastercard.js';

describe('mastercard parser', () => {
    describe('contract', () => {
        it('has correct id and metadata', () => {
            expect(mastercardParser.id).toBe('mastercard');
            expect(mastercardParser.account).toBe('Mastercard');
            expect(mastercardParser.hasHeader).toBe(true);
        });
    });

    describe('detect', () => {
        it('detects mastercard header', () => {
            expect(mastercardParser.detect('description,type,card holder name,date,time,amount')).toBe(true);
        });

        it('rejects unrelated header', () => {
            expect(mastercardParser.detect('some,random,header')).toBe(false);
        });
    });

    describe('parseLine', () => {
        it('parses purchase as expense', () => {
            const result = mastercardParser.parseLine('STARBUCKS,PURCHASE,JOHN DOE,2/5/2025,10:00 AM,15.75');
            expect(result.type).toBe('expense');
            expect(result.amount).toBe(15.75);
            expect(result.account).toBe('Mastercard');
        });

        it('parses payment as income', () => {
            const result = mastercardParser.parseLine('PAYMENT,PAYMENT,JOHN DOE,2/5/2025,10:00 AM,500.00');
            expect(result.type).toBe('income');
        });

        it('appends cardholder to description', () => {
            const result = mastercardParser.parseLine('COFFEE SHOP,PURCHASE,JANE DOE,2/5/2025,10:00 AM,5.00');
            expect(result.description).toBe('COFFEE SHOP (JANE DOE)');
        });

        it('returns null for too few fields', () => {
            expect(mastercardParser.parseLine('desc,type,name')).toBeNull();
        });

        it('returns null for invalid date', () => {
            expect(mastercardParser.parseLine('TEST,PURCHASE,JOHN,bad/date,10:00,50')).toBeNull();
        });
    });
});
