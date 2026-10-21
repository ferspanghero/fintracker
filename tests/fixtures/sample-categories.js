// Test-only category list: every category the tests route to, so categorizer
// tests can reach any route. The app itself starts with only "Sem Categoria"
// and reads the list from settings.
export const SAMPLE_CATEGORIES = {
    expense: [
        'Casa', 'Tarifa', 'Dívida', 'Saúde', 'Mercado', 'Telefone', 'Alimentação',
        'Vestuário', 'Outro', 'Lazer', 'Viagem', 'Transporte', 'Educação', 'Presente',
        'Empréstimo', 'Sem Categoria'
    ],
    income: ['Trabalho', 'Investimento', 'Reembolso', 'Outro', 'Sem Categoria']
};
