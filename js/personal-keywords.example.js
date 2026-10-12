// Personal keyword overrides — template file.
//
// Copy this to `personal-keywords.js` (gitignored) and add your own keywords.
// Anything you put here is prepended to the generic keyword lists in
// category-engine.js, so it wins under first-match-wins. This is where
// merchant names, banks, local stores, and anything else you don't want
// in a public repo should live.
//
// Structure mirrors categoryKeywords in category-engine.js. Categories you
// don't care about can be left as empty arrays or omitted entirely.

export const personalKeywords = {
    expense: {
        'Viagem': [],
        'Casa': [],
        'Tarifa': [],
        'Dívida': [],
        'Saúde': [],
        'Mercado': [],
        'Telefone': [],
        'Alimentação': [],
        'Vestuário': [],
        'Outro': [],
        'Lazer': [],
        'Transporte': [],
        'Educação': [],
        'Presente': [],
        'Empréstimo': []
    },
    income: {
        'Trabalho': [],
        'Investimento': [],
        'Reembolso': [],
        'Outro': []
    }
};

// Import ignore list: rows whose description STARTS WITH one of these phrases
// (trimmed, case-insensitive) are skipped on import, like duplicates. Use it
// for money moving between your own accounts. Write complete phrases — see
// ignore-rules.js for the generic ones and why.
export const ignorePrefixes = [];
