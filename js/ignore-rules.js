// Import ignore list: imported rows whose description starts with one of these
// prefixes are skipped, the same way duplicates are. Meant for money moving
// between your own accounts (card payments, savings transfers), which would
// otherwise show up twice — as an expense on one account and income on another.
//
// Matching is trim + case-insensitive "starts with" on the whole description,
// so list complete phrases: a bare 'payment' would swallow legitimate rows.
// Generic bank wording lives here; anything identifying (your bank, account
// nicknames) goes in the gitignored personal file's `ignorePrefixes` export.
//
// Assumption: both sides of a card payment are imported. Paying a card whose
// statement you don't import makes that bank-side payment vanish from totals.

export const genericIgnorePrefixes = Object.freeze([
    'payment received - thank you',
    'payment - thank you',
    'internet bill payment mastercard',
    'internet bill payment american express'
]);

function normalize(text) {
    return text.trim().toLowerCase();
}

/**
 * Loads the ignore prefixes: the optional personal `ignorePrefixes` export
 * followed by the generic ones, all normalized, with blank and non-string
 * entries dropped (a blank prefix would match every row).
 * @param {string} [personalKeywordsPath] path to the personal keywords module,
 *   resolved relative to this file; a missing file or export is fine.
 * @returns {Promise<string[]>}
 */
export async function loadIgnorePrefixes(personalKeywordsPath) {
    let personalPrefixes = [];

    if (personalKeywordsPath) {
        try {
            const mod = await import(personalKeywordsPath);

            if (Array.isArray(mod.ignorePrefixes)) personalPrefixes = mod.ignorePrefixes;
        } catch {
            // personal keywords file not present — generic prefixes only
        }
    }

    const personal = personalPrefixes
        .filter(prefix => typeof prefix === 'string')
        .map(normalize)
        .filter(Boolean);

    return [...personal, ...genericIgnorePrefixes];
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
