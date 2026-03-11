import { describe, it, expect } from 'vitest';
import { parsers, getParserById, detectParser } from '../../js/parsers/index.js';

describe('parser registry', () => {
    describe('parsers array', () => {
        it('contains all 6 parsers', () => {
            expect(parsers.length).toBe(6);
        });

        it('has td as last entry (fallback)', () => {
            expect(parsers[parsers.length - 1].id).toBe('td');
        });

        it('has fintracker as first entry (most specific)', () => {
            expect(parsers[0].id).toBe('fintracker');
        });

        it('every parser has required contract properties', () => {
            for (const parser of parsers) {
                expect(parser.id).toBeTruthy();
                expect(parser.name).toBeTruthy();
                expect(typeof parser.hasHeader).toBe('boolean');
                expect(typeof parser.detect).toBe('function');
                expect(typeof parser.parseDate).toBe('function');
                expect(typeof parser.parseLine).toBe('function');
            }
        });
    });

    describe('getParserById', () => {
        it('returns parser by id', () => {
            expect(getParserById('amex').id).toBe('amex');
            expect(getParserById('mastercard').id).toBe('mastercard');
            expect(getParserById('td').id).toBe('td');
            expect(getParserById('simplii').id).toBe('simplii');
            expect(getParserById('bradesco').id).toBe('bradesco');
            expect(getParserById('fintracker').id).toBe('fintracker');
        });

        it('returns null for unknown id', () => {
            expect(getParserById('nonexistent')).toBeNull();
        });
    });

    describe('detectParser', () => {
        it('detects fintracker format', () => {
            expect(detectParser('Date,Description,Category,Account,Amount,Type').id).toBe('fintracker');
        });

        it('detects amex format', () => {
            expect(detectParser('Date,Date Processed,Description,Amount').id).toBe('amex');
        });

        it('detects mastercard format', () => {
            expect(detectParser('Description,Type,Card Holder Name,Date,Time,Amount').id).toBe('mastercard');
        });

        it('detects simplii format', () => {
            expect(detectParser('Date, Transaction Details, Funds Out, Funds In').id).toBe('simplii');
        });

        it('detects bradesco format', () => {
            expect(detectParser('Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)').id).toBe('bradesco');
        });

        it('falls back to td for unknown headers', () => {
            expect(detectParser('some,random,header').id).toBe('td');
        });

        it('is case insensitive', () => {
            expect(detectParser('DATE,DESCRIPTION,CATEGORY,ACCOUNT,AMOUNT,TYPE').id).toBe('fintracker');
        });
    });
});
