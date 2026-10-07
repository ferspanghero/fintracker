import { describe, it, expect } from 'vitest';
import { BRLtoCAD } from '../../js/utils.js';
import bradescoParser from '../../js/parsers/bradesco.js';

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

    describe('parseLine', () => {
        it('parses credit as income with BRL conversion', () => {
            const result = bradescoParser.parseLine('26/02/2025;SALARIO;12345;1.000,50;;5.000,00');
            expect(result.type).toBe('income');
            expect(result.amount).toBeCloseTo(BRLtoCAD(1000.50));
            expect(result.account).toBe('Bradesco');
        });

        it('parses debit as expense with BRL conversion', () => {
            const result = bradescoParser.parseLine('26/02/2025;MERCADO;12345;;500,00;4.500,00');
            expect(result.type).toBe('expense');
            expect(result.amount).toBeCloseTo(BRLtoCAD(500));
        });

        it('strips BOM character', () => {
            const result = bradescoParser.parseLine('\uFEFF26/02/2025;SALARIO;12345;1.000,50;;5.000,00');
            expect(result).toBeTruthy();
            expect(result.type).toBe('income');
        });

        it('skips Extrato metadata row', () => {
            expect(bradescoParser.parseLine('Extrato;foo;bar;baz;qux;quux')).toBeNull();
        });

        it('skips the account title row', () => {
            expect(bradescoParser.parseLine('Extrato de: Ag: 0000 | Conta: 000000-0;;;;;')).toBeNull();
        });

        it('skips Filtro metadata row', () => {
            expect(bradescoParser.parseLine('Filtro;foo;bar;baz;qux;quux')).toBeNull();
        });

        it('skips Total metadata row', () => {
            expect(bradescoParser.parseLine('Total;foo;bar;baz;qux;quux')).toBeNull();
        });

        it('skips header row', () => {
            expect(bradescoParser.parseLine('Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)')).toBeNull();
        });

        it('returns null when no credit or debit', () => {
            expect(bradescoParser.parseLine('26/02/2025;desc;123;;;5.000,00')).toBeNull();
        });

        it('returns null for too few fields', () => {
            expect(bradescoParser.parseLine('26/02/2025;desc')).toBeNull();
        });

        it('returns null for invalid date', () => {
            expect(bradescoParser.parseLine('bad/date;desc;123;1.000,00;;5.000,00')).toBeNull();
        });

        it('handles Brazilian number format correctly', () => {
            const result = bradescoParser.parseLine('26/02/2025;desc;123;10.500,75;;50.000,00');
            expect(result.amount).toBeCloseTo(BRLtoCAD(10500.75));
        });

        it('handles amounts with multiple thousand separators (>= 1M BRL)', () => {
            const result = bradescoParser.parseLine('26/02/2025;desc;123;1.000.500,75;;5.000.000,00');
            expect(result.amount).toBeCloseTo(BRLtoCAD(1000500.75));
        });
    });
});
