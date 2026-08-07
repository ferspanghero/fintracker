// Fixture used by category-engine.test.js to verify that a personal keyword can
// claim a description a generic keyword would otherwise take. Real merchant
// names stay out of version control, so each sentinel embeds the generic
// keyword it has to win against.
export const personalKeywords = {
    expense: {
        // Embeds 'food', a generic Alimentação keyword. Mercado is scanned
        // first, so the personal entry decides the route.
        'Mercado': ['zzsentinelfoodzz'],
        // Embeds 'holidays'. Viagem is scanned before Alimentação and claimed
        // this outright while its keyword was the bare word 'holiday'.
        'Alimentação': ['zzsentinelholidayszz']
    },
    income: {
        'Trabalho': ['zzsentineltrabalhozz']
    }
};
