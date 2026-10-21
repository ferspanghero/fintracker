// Import ignore list: imported rows whose description starts with one of these
// prefixes are skipped, the same way duplicates are. Meant for money moving
// between your own accounts (card payments, savings transfers), which would
// otherwise show up twice — as an expense on one account and income on another.
//
// Matching is trim + case-insensitive "starts with" on the whole description,
// so list complete phrases: a bare 'payment' would swallow legitimate rows.
// The prefixes live only in the gitignored keywords file's `ignorePrefixes`
// export; without it nothing is skipped.
//
// Assumption: both sides of a card payment are imported. Paying a card whose
// statement you don't import makes that bank-side payment vanish from totals.

import { importKeywordsFile } from './keywords-file.js';

function normalize(text) {
    return text.trim().toLowerCase();
}

/**
 * Loads the ignore prefixes from the keywords module's `ignorePrefixes` export,
 * normalized, with blank and non-string entries dropped (a blank prefix would
 * match every row).
 * @param {string} [keywordsPath] path to the keywords module, resolved
 *   relative to `js/`; a missing file or export means no prefixes.
 * @returns {Promise<string[]>}
 */
export async function loadIgnorePrefixes(keywordsPath) {
    const mod = await importKeywordsFile(keywordsPath);
    const prefixes = Array.isArray(mod.ignorePrefixes) ? mod.ignorePrefixes : [];

    return prefixes
        .filter(prefix => typeof prefix === 'string')
        .map(normalize)
        .filter(Boolean);
}

/**
 * Whether an imported description should be skipped.
 * @param {string | undefined} description
 * @param {string[]} prefixes normalized prefixes, as returned by loadIgnorePrefixes
 * @returns {boolean}
 */
export function isIgnored(description, prefixes) {
    const normalized = normalize(description ?? '');

    return prefixes.some(prefix => normalized.startsWith(prefix));
}
