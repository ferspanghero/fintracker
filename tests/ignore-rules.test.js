import { describe, it, expect } from 'vitest';
import { loadIgnorePrefixes, isIgnored } from '../js/ignore-rules.js';

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

describe('loadIgnorePrefixes', () => {
    it('returns no prefixes when no path is given', async () => {
        // Act, Assert
        expect(await loadIgnorePrefixes()).toEqual([]);
    });

    it('returns no prefixes when the file is missing', async () => {
        // Act, Assert
        expect(await loadIgnorePrefixes('./definitely-not-present-xyz.js')).toEqual([]);
    });

    it('returns no prefixes when the file has no ignorePrefixes export', async () => {
        // Act, Assert
        expect(await loadIgnorePrefixes('../tests/fixtures/empty-personal-keywords.js')).toEqual([]);
    });

    it('normalizes the file\'s prefixes and drops blank and non-string entries', async () => {
        // Act
        const prefixes = await loadIgnorePrefixes('../tests/fixtures/ignore-personal-keywords.js');

        // Assert
        expect(prefixes).toEqual(['sentinel transfer', 'sentinel card payment']);
    });
});
