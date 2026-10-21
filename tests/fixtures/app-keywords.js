// Stand-in for the gitignored js/personal-keywords.js: vitest.config.js aliases
// the app's import to this file and the E2E server serves it in its place, so
// no test depends on the developer's private keywords. Generic words only.
export const personalKeywords = {
    expense: {
        'Viagem': ['hotel'],
        // Declared before Empréstimo, which lists the same phrase, so it wins.
        'Dívida': ['student loan'],
        'Mercado': ['costco'],
        'Alimentação': ['starbucks'],
        'Lazer': ['netflix'],
        'Transporte': ['uber'],
        'Empréstimo': ['student loan']
    },
    income: {
        'Trabalho': ['payroll'],
        'Investimento': ['dividend'],
        'Reembolso': ['cashback']
    }
};

export const ignorePrefixes = ['payment received - thank you'];
