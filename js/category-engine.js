// Pure categorization logic — no DOM dependencies, no module-level state.
// Consumers call `loadCategoryKeywords(path)` to obtain the keyword map, then
// pass it to `categorizeTransaction(desc, type, keywords)`.
//
// The keywords themselves live only in a gitignored file whose path the caller
// passes in; `personal-keywords.example.js` is the committed template.

import { INCOME, EXPENSE, TRANSACTION_TYPES } from './constants.js';
import { importKeywordsFile } from './keywords-file.js';

export const UNCATEGORIZED = 'Sem Categoria';
/** Where an income row that only matches expense keywords goes: a refund of a purchase. */
export const REFUND_CATEGORY = 'Reembolso';

// Keywords trimmed and lowercased (descriptions are matched lowercased), with
// blank and non-string entries dropped.
const cleanKeywords = list => list
    .filter(keyword => typeof keyword === 'string')
    .map(keyword => keyword.trim().toLowerCase())
    .filter(Boolean);

// Loads the keyword map from the module at `keywordsPath` (its `personalKeywords`
// export). Categories keep the order the file declares them in, which decides
// first-match-wins ties. A missing file or export means no keywords, so every
// description comes back Sem Categoria.
//
// Paths are resolved relative to `js/`, so callers there can pass
// `./personal-keywords.js` and tests can pass `../tests/fixtures/...`.
export async function loadCategoryKeywords(keywordsPath) {
    const { personalKeywords = {} } = await importKeywordsFile(keywordsPath);
    const typeMap = categories => Object.fromEntries(
        Object.entries(categories ?? {}).map(([category, list]) => [category, cleanKeywords(list)])
    );

    return { expense: typeMap(personalKeywords.expense), income: typeMap(personalKeywords.income) };
}

/**
 * Narrows a keyword map to the categories the user has, keeping the map's declared order
 * so first-match-wins precedence is unchanged; a description whose category is
 * missing falls through to the next allowed category.
 * @param {{expense: object, income: object}} categoryKeywords map from loadCategoryKeywords
 * @param {{expense?: string[], income?: string[]}} allowed category names per type
 * @returns {{expense: object, income: object}}
 */
export function restrictKeywords(categoryKeywords, allowed) {
    const restricted = {};
    for (const type of TRANSACTION_TYPES) {
        const names = allowed[type] ?? [];
        restricted[type] = Object.fromEntries(
            Object.entries(categoryKeywords[type] ?? {}).filter(([category]) => names.includes(category))
        );
    }
    return restricted;
}

// Categorize a transaction by scanning a pre-built keyword map.
export function categorizeTransaction(description, type, categoryKeywords) {
    if (!categoryKeywords || !categoryKeywords[type]) return UNCATEGORIZED;

    description = description.toLowerCase();

    for (const [category, keywords] of Object.entries(categoryKeywords[type])) {
        for (const keyword of keywords) {
            if (description.includes(keyword)) {
                return category;
            }
        }
    }

    // Income fallback: if description matches an expense keyword, it's a refund
    if (type === INCOME) {
        for (const keywords of Object.values(categoryKeywords[EXPENSE])) {
            for (const keyword of keywords) {
                if (description.includes(keyword)) {
                    return REFUND_CATEGORY;
                }
            }
        }
    }

    return UNCATEGORIZED;
}
