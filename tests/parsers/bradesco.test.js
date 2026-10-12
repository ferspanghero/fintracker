import { describe, it, expect } from 'vitest';
import bradescoParser from '../../js/parsers/bradesco.js';

const ctx = { rates: { BRL: 0.3 } };

describe('bradesco parser', () => {
    describe('contract', () => {
        it('has correct id and metadata', () => {
            expect(bradescoParser.id).toBe('bradesco');
            expect(bradescoParser.account).toBe('Bradesco');
            expect(bradescoParser.hasHeader).toBe(true);
        });
    });

    describe('detect', () => {
        it('detects bradesco header', () => {
            expect(bradescoParser.detect('data;histórico;docto.;crédito (r$);débito (r$);saldo (r$)')).toBe(true);
        });

        it('detects the account title row that precedes the header', () => {
            expect(bradescoParser.detect('extrato de: ag: 0000 | conta: 000000-0;;;;;')).toBe(true);
        });

        it('rejects an extrato title without agency and account', () => {
            expect(bradescoParser.detect('extrato de: conta corrente;;;;;')).toBe(false);
        });

        it('rejects ag: when it only appears inside another word', () => {
            expect(bradescoParser.detect('extrato de: pag: 0000 | conta: 000000-0;;;;;')).toBe(false);
        });

        it('rejects unrelated header', () => {
            expect(bradescoParser.detect('some,random,header')).toBe(false);
        });
    });

    describe('validateContext', () => {
        it('requires a BRL rate', () => {
            // Act, Assert
            expect(bradescoParser.validateContext({ rates: { BRL: null } }))
                .toBe('Set the BRL → CAD rate in Settings before importing Bradesco files.');
        });

        it('accepts a positive BRL rate', () => {
            // Act, Assert
            expect(bradescoParser.validateContext(ctx)).toBeNull();
        });
    });

    describe('parseLine', () => {
        it('converts with the rate from the context', () => {
            // Act
            const result = bradescoParser.parseLine('26/02/2025;MERCADO;12345;;100,00;4.500,00', { rates: { BRL: 0.2 } });

            // Assert
            expect(result.amount).toBeCloseTo(20);
        });

        it('parses credit as income with BRL conversion', () => {
            const result = bradescoParser.parseLine('26/02/2025;SALARIO;12345;1.000,50;;5.000,00', ctx);
            expect(result.type).toBe('income');
            expect(result.amount).toBeCloseTo(1000.50 * 0.3);
            expect(result.account).toBe('Bradesco');
        });

        it('parses debit as expense with BRL conversion', () => {
            const result = bradescoParser.parseLine('26/02/2025;MERCADO;12345;;500,00;4.500,00', ctx);
            expect(result.type).toBe('expense');
            expect(result.amount).toBeCloseTo(500 * 0.3);
        });

        it('strips BOM character', () => {
            const result = bradescoParser.parseLine('\uFEFF26/02/2025;SALARIO;12345;1.000,50;;5.000,00', ctx);
            expect(result).toBeTruthy();
            expect(result.type).toBe('income');
        });

        it('skips Extrato metadata row', () => {
            expect(bradescoParser.parseLine('Extrato;foo;bar;baz;qux;quux', ctx)).toBeNull();
        });

        it('skips the account title row', () => {
            expect(bradescoParser.parseLine('Extrato de: Ag: 0000 | Conta: 000000-0;;;;;', ctx)).toBeNull();
        });

        it('skips Filtro metadata row', () => {
            expect(bradescoParser.parseLine('Filtro;foo;bar;baz;qux;quux', ctx)).toBeNull();
        });

        it('skips Total metadata row', () => {
            expect(bradescoParser.parseLine('Total;foo;bar;baz;qux;quux', ctx)).toBeNull();
        });

        it('skips header row', () => {
            expect(bradescoParser.parseLine('Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)', ctx)).toBeNull();
        });

        it('returns null when no credit or debit', () => {
            expect(bradescoParser.parseLine('26/02/2025;desc;123;;;5.000,00', ctx)).toBeNull();
        });

        it('returns null for too few fields', () => {
            expect(bradescoParser.parseLine('26/02/2025;desc', ctx)).toBeNull();
        });

        it('returns null for invalid date', () => {
            expect(bradescoParser.parseLine('bad/date;desc;123;1.000,00;;5.000,00', ctx)).toBeNull();
        });

        it('handles Brazilian number format correctly', () => {
            const result = bradescoParser.parseLine('26/02/2025;desc;123;10.500,75;;50.000,00', ctx);
            expect(result.amount).toBeCloseTo(10500.75 * 0.3);
        });

        it('handles amounts with multiple thousand separators (>= 1M BRL)', () => {
            const result = bradescoParser.parseLine('26/02/2025;desc;123;1.000.500,75;;5.000.000,00', ctx);
            expect(result.amount).toBeCloseTo(1000500.75 * 0.3);
        });
    });
});
