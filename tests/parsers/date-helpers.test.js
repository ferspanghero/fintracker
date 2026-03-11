import { describe, it, expect } from 'vitest';
import { validateDate, parseYMD, parseNamedMonth, parseMDY, parseDMY } from '../../js/parsers/date-helpers.js';

describe('validateDate', () => {
    it('returns valid Date as-is', () => {
        const d = new Date(2025, 3, 12);
        expect(validateDate(d)).toBe(d);
    });

    it('returns null for invalid Date', () => {
        expect(validateDate(new Date('invalid'))).toBeNull();
    });

    it('returns null for non-Date input', () => {
        expect(validateDate('2025-04-12')).toBeNull();
    });
});

describe('parseYMD (YYYY-MM-DD)', () => {
    it('parses standard date', () => {
        const result = parseYMD('2025-04-12');
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(3);
        expect(result.getDate()).toBe(12);
    });

    it('parses single-digit day/month', () => {
        const result = parseYMD('2025-01-05');
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(0);
        expect(result.getDate()).toBe(5);
    });

    it('returns null for invalid date string', () => {
        expect(parseYMD('bad-date')).toBeNull();
    });

    it('returns null for null/undefined input', () => {
        expect(parseYMD(null)).toBeNull();
        expect(parseYMD(undefined)).toBeNull();
    });
});

describe('parseNamedMonth (DD MMM YYYY)', () => {
    it('parses standard date', () => {
        const result = parseNamedMonth('28 Feb 2025');
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(28);
    });

    it('parses all 12 months', () => {
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        months.forEach((month, idx) => {
            const result = parseNamedMonth(`01 ${month} 2025`);
            expect(result.getMonth()).toBe(idx);
        });
    });

    it('returns null for unknown month abbreviation', () => {
        expect(parseNamedMonth('01 Xyz 2025')).toBeNull();
    });

    it('returns null for malformed input', () => {
        expect(parseNamedMonth('bad')).toBeNull();
    });

    it('returns null for null/undefined input', () => {
        expect(parseNamedMonth(null)).toBeNull();
        expect(parseNamedMonth(undefined)).toBeNull();
    });
});

describe('parseMDY (M/D/YYYY)', () => {
    it('parses standard date', () => {
        const result = parseMDY('2/5/2025');
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(5);
    });

    it('parses padded date', () => {
        const result = parseMDY('02/05/2025');
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(5);
    });

    it('parses simplii date', () => {
        const result = parseMDY('12/31/2025');
        expect(result.getMonth()).toBe(11);
        expect(result.getDate()).toBe(31);
    });

    it('returns null for invalid date string', () => {
        expect(parseMDY('bad/date')).toBeNull();
    });

    it('returns null for null/undefined input', () => {
        expect(parseMDY(null)).toBeNull();
        expect(parseMDY(undefined)).toBeNull();
    });
});

describe('parseDMY (DD/MM/YYYY)', () => {
    it('parses standard date', () => {
        const result = parseDMY('26/02/2025');
        expect(result.getFullYear()).toBe(2025);
        expect(result.getMonth()).toBe(1);
        expect(result.getDate()).toBe(26);
    });

    it('returns null for invalid date string', () => {
        expect(parseDMY('bad/date')).toBeNull();
    });

    it('returns null for null/undefined input', () => {
        expect(parseDMY(null)).toBeNull();
        expect(parseDMY(undefined)).toBeNull();
    });
});
