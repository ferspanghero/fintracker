import { describe, it, expect } from 'vitest';
import { genericIgnorePrefixes, loadIgnorePrefixes, isIgnored } from '../js/ignore-rules.js';

describe('isIgnored', () => {
    const prefixes = ['card payment - thank you'];

    it('matches a description that starts with a prefix, ignoring case', () => {
        expect(isIgnored('CARD PAYMENT - THANK YOU', prefixes)).toBe(true);
    });

    it('matches when the description continues past the prefix', () => {
        expect(isIgnored('Card Payment - Thank You (HOLDER)', prefixes)).toBe(true);
    });

    it('trims the description before matching', () => {
        expect(isIgnored('   card payment - thank you  ', prefixes)).toBe(true);
    });

    it('does not match when the phrase appears mid-description', () => {
        expect(isIgnored('REFUND card payment - thank you', prefixes)).toBe(false);
    });

    it('does not match when the description is shorter than the prefix', () => {
        expect(isIgnored('card payment', prefixes)).toBe(false);
    });

    it('does not match an empty description', () => {
        expect(isIgnored('', prefixes)).toBe(false);
    });

    it('does not match a missing description', () => {
        expect(isIgnored(undefined, prefixes)).toBe(false);
    });

    it('matches nothing when the prefix list is empty', () => {
        expect(isIgnored('card payment - thank you', [])).toBe(false);
    });
});

describe('genericIgnorePrefixes', () => {
    it('stores entries already trimmed and lowercased', () => {
        for (const prefix of genericIgnorePrefixes) {
            expect(prefix).toBe(prefix.trim().toLowerCase());
            expect(prefix).not.toBe('');
        }
    });

    it.each([
        'PAYMENT RECEIVED - THANK YOU',
        'PAYMENT - THANK YOU',
        'INTERNET BILL PAYMENT MASTERCARD SENTINEL ISSUER',
        'INTERNET BILL PAYMENT AMERICAN EXPRESS SENTINEL'
    ])('ignores the card-payment row "%s"', (description) => {
        expect(isIgnored(description, genericIgnorePrefixes)).toBe(true);
    });

    it.each([
        'INTERNET BILL PAYMENT SENTINEL UTILITY',
        'INTERNET BILL PAYMENT SENTINEL CITY TAX',
        'THANK YOU CAFE',
        'PAYMENT PLAN FEE'
    ])('keeps the legitimate row "%s"', (description) => {
        expect(isIgnored(description, genericIgnorePrefixes)).toBe(false);
    });
});

describe('loadIgnorePrefixes', () => {
    it('returns only the generic prefixes when no path is given', async () => {
        expect(await loadIgnorePrefixes()).toEqual(genericIgnorePrefixes);
    });

    it('returns only the generic prefixes when the personal file is missing', async () => {
        expect(await loadIgnorePrefixes('./definitely-not-present-xyz.js')).toEqual(genericIgnorePrefixes);
    });

    it('returns only the generic prefixes when the personal file has no ignorePrefixes export', async () => {
        expect(await loadIgnorePrefixes('../tests/fixtures/empty-personal-keywords.js')).toEqual(genericIgnorePrefixes);
    });

    it('merges normalized personal prefixes and drops blank and non-string entries', async () => {
        const prefixes = await loadIgnorePrefixes('../tests/fixtures/ignore-personal-keywords.js');

        expect(prefixes).toEqual([
            'sentinel transfer',
            'sentinel card payment',
            ...genericIgnorePrefixes
        ]);
    });
});
