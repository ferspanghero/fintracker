import { describe, it, expect } from 'vitest';
import { dateStrInputToLocalDate, parseCSVLine, BRLtoCAD, BRL_TO_CAD_RATE, escapeHTML } from '../js/utils.js';

describe('dateStrInputToLocalDate', () => {
    it('parses YYYY-MM-DD to local date', () => {
        const result = dateStrInputToLocalDate('2025-02-26');
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(26);
    });

    it('handles first day of year', () => {
        const result = dateStrInputToLocalDate('2025-01-01');
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(1);
    });

    it('handles last day of year', () => {
        const result = dateStrInputToLocalDate('2025-12-31');
        expect(result.getMonth()).toBe(11);
        expect(result.getDate()).toBe(31);
    });

    it('returns null for empty string', () => {
        expect(dateStrInputToLocalDate('')).toBeNull();
    });

    it('returns null for undefined', () => {
        expect(dateStrInputToLocalDate(undefined)).toBeNull();
    });

    it('returns null for invalid date string', () => {
        expect(dateStrInputToLocalDate('not-a-date')).toBeNull();
    });
});

describe('parseCSVLine', () => {
    it('parses simple comma-separated values', () => {
        expect(parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
    });

    it('handles quoted field with comma', () => {
        expect(parseCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    });

    it('handles empty fields', () => {
        expect(parseCSVLine(',,')).toEqual(['', '', '']);
    });

    it('handles single field', () => {
        expect(parseCSVLine('abc')).toEqual(['abc']);
    });

    it('handles empty string', () => {
        expect(parseCSVLine('')).toEqual(['']);
    });

    it('handles quoted field with no special chars', () => {
        expect(parseCSVLine('"hello",world')).toEqual(['hello', 'world']);
    });

    it('handles mixed quoted and unquoted', () => {
        const result = parseCSVLine('2025-01-01,"Starbucks, coffee",12.50,expense');
        expect(result).toEqual(['2025-01-01', 'Starbucks, coffee', '12.50', 'expense']);
    });

    it('handles escaped quotes inside quoted fields', () => {
        const result = parseCSVLine('"he said ""hello""",world');
        expect(result[0]).toBe('he said "hello"');
        expect(result[1]).toBe('world');
    });

    it('handles single escaped quote in quoted field', () => {
        const result = parseCSVLine('"say ""hi""",test');
        expect(result[0]).toBe('say "hi"');
    });

    it('handles consecutive escaped quotes', () => {
        const result = parseCSVLine('"a""""b",c');
        expect(result[0]).toBe('a""b');
    });
});

describe('BRLtoCAD', () => {
    it('uses the exported BRL_TO_CAD_RATE constant', () => {
        expect(BRL_TO_CAD_RATE).toBe(0.25);
        expect(BRLtoCAD(100)).toBe(100 * BRL_TO_CAD_RATE);
    });

    it('converts positive amount', () => {
        expect(BRLtoCAD(100)).toBe(25);
    });

    it('converts zero', () => {
        expect(BRLtoCAD(0)).toBe(0);
    });

    it('converts negative amount', () => {
        expect(BRLtoCAD(-50)).toBe(-12.5);
    });

    it('converts decimal amount', () => {
        expect(BRLtoCAD(10.50)).toBeCloseTo(2.625);
    });
});

describe('escapeHTML', () => {
    it('escapes ampersand', () => {
        expect(escapeHTML('a&b')).toBe('a&amp;b');
    });

    it('escapes less-than', () => {
        expect(escapeHTML('a<b')).toBe('a&lt;b');
    });

    it('escapes greater-than', () => {
        expect(escapeHTML('a>b')).toBe('a&gt;b');
    });

    it('escapes double quotes', () => {
        expect(escapeHTML('a"b')).toBe('a&quot;b');
    });

    it('escapes single quotes', () => {
        expect(escapeHTML("a'b")).toBe('a&#39;b');
    });

    it('escapes multiple special characters', () => {
        expect(escapeHTML('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    });

    it('returns empty string unchanged', () => {
        expect(escapeHTML('')).toBe('');
    });

    it('returns safe string unchanged', () => {
        expect(escapeHTML('hello world')).toBe('hello world');
    });
});
