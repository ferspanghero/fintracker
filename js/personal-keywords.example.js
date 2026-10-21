// Category keywords and import ignore list — template file.
//
// Copy this to `personal-keywords.js` (gitignored) and fill it in. It is the
// app's only source of keywords: without it every imported row lands in
// Sem Categoria and nothing is skipped.
//
// Matching is case-insensitive substring, first match wins: categories are
// scanned in the order declared below, then keywords within each. A keyword in
// an earlier category beats one in a later category, so prefer narrow phrases
// (`holiday inn`, not `holiday`). Write keywords in lowercase. Categories you
// don't use can stay empty or be left out.

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
// for money moving between your own accounts. Write complete phrases: a bare
// 'payment' would skip legitimate rows.
export const ignorePrefixes = [];
