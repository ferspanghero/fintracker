import { describe, it, expect } from 'vitest';
import fintrackerParser from '../../js/parsers/fintracker.js';

describe('fintracker parser', () => {
    describe('contract', () => {
        it('has correct id and metadata', () => {
            expect(fintrackerParser.id).toBe('fintracker');
            expect(fintrackerParser.account).toBeUndefined();
            expect(fintrackerParser.hasHeader).toBe(true);
        });
    });

    describe('detect', () => {
        it('detects fintracker header', () => {
            expect(fintrackerParser.detect('date,description,category,account,amount,type')).toBe(true);
        });

        it('rejects unrelated header', () => {
            expect(fintrackerParser.detect('some,random,header')).toBe(false);
        });
    });

    describe('parseLine', () => {
        it('parses valid expense line', () => {
            const result = fintrackerParser.parseLine('2025-04-12,Groceries,Mercado,Simplii,55.00,expense');
            expect(result.date.getFullYear()).toBe(2025);
            expect(result.description).toBe('Groceries');
            expect(result.category).toBe('Mercado');
            expect(result.account).toBe('Simplii');
            expect(result.amount).toBe(55);
            expect(result.type).toBe('expense');
        });

        it('parses valid income line', () => {
            const result = fintrackerParser.parseLine('2025-04-12,Salary,Trabalho,TD,3000.00,income');
            expect(result.type).toBe('income');
            expect(result.amount).toBe(3000);
        });

        it('parses quoted description with comma', () => {
            const result = fintrackerParser.parseLine('2025-04-12,"Coffee, Starbucks",Alimentação,Amex,5.50,expense');
            expect(result.description).toBe('Coffee, Starbucks');
        });

        it('returns null for too few fields', () => {
            expect(fintrackerParser.parseLine('2025-04-12,Groceries,Mercado')).toBeNull();
        });

        it('returns null for invalid date', () => {
            expect(fintrackerParser.parseLine('bad-date,Test,Casa,Amex,50,expense')).toBeNull();
        });

        it('sets category to empty string when CSV field is empty', () => {
            const result = fintrackerParser.parseLine('2025-04-12,COSTCO,,Simplii,100.00,expense');
            expect(result.category).toBe('');
        });

        it('reads account from CSV', () => {
            const result = fintrackerParser.parseLine('2025-04-12,Test,Casa,MyBank,50,expense');
            expect(result.account).toBe('MyBank');
        });
    });

    it('throws on a type other than income or expense', () => {
        // Act, Assert
        expect(() => fintrackerParser.parseLine('2025-04-12,Test,Casa,MyBank,50,transfer')).toThrow('Invalid type "transfer"');
    });
});
