// Pure categorization data and logic — no DOM dependencies, no module-level
// state. Consumers call `loadCategoryKeywords(path?)` to obtain a merged
// keyword map, then pass it to `categorizeTransaction(desc, type, keywords)`.
//
// This file contains only generic keywords (concepts + well-known global brands).
// Personal/local merchants, banks, and anything else that would leak private
// information live in a gitignored file whose path the caller passes in.
// A committed `personal-keywords.example.js` is provided as a template.

export const UNCATEGORIZED = 'Sem Categoria';

// Default categories in Brazilian Portuguese
export const defaultCategories = {
    expense: [
        'Casa',
        'Tarifa',
        'Dívida',
        'Saúde',
        'Mercado',
        'Telefone',
        'Alimentação',
        'Vestuário',
        'Outro',
        'Lazer',
        'Viagem',
        'Transporte',
        'Educação',
        'Internet',
        'Presente',
        'Curso',
        'Empréstimo',
        UNCATEGORIZED
    ],
    income: [
        'Trabalho',
        'Investimento',
        'Reembolso',
        'Outro',
        UNCATEGORIZED
    ]
};

// Generic keywords — concepts and well-known global brands only.
const genericKeywords = {
    expense: {
        'Viagem': [
            'viagem', 'travel', 'vacation', 'journey',
            'hotel', 'flight', 'booking', 'airbnb', 'expedia',
            'cruise', 'motel', 'lodging', 'accommodation', 'airline',
            'holiday inn', 'tour', 'resort', 'marriott',
            'empreend', 'turi', 'pix', 'airalo', 'priority pass',
            'aircanada', 'air can', 'localiza'
        ],
        'Casa': [
            'home', 'mortgage', 'property', 'utility', 'insurance',
            'apartment', 'condo', 'real estate', 'housing',
            'repair', 'improvement', 'furniture',
            'hydro', 'handyman', 'winners', 'canadian tire'
        ],
        'Tarifa': [
            'tarifa', 'membership', 'annual', 'penalty', 'overdraft', 'tax',
            'adjusted cost base', 'adjustedcostbase', 'doc/ted'
        ],
        'Dívida': [
            'dívida', 'debt', 'bill', 'plano de saúde', 'student loan'
        ],
        'Saúde': [
            'saúde', 'health', 'medical', 'doctor', 'pharmacy',
            'clinic', 'therapy', 'wellness', 'exames', 'consulta',
            'terapia', 'physician', 'hospital', 'dental', 'dentist',
            'eye', 'prescription', 'medicine', 'healthcare',
            'drogaria', 'pharma', 'farmacia', 'counseling',
            'cabeleireiro', 'shoppers', 'sdm', 'pague menos', 'sephora'
        ],
        'Mercado': [
            'merc', 'grocery', 'market', 'supermarket', 'costco', 'safeway',
            'walmart', 'home depot', 'dollar tree', 'target', 'trader',
            'whole foods', 'aldi', 'kroger', 'publix', 'shoprite',
            'dollar store', 'dollarama', 'haggen'
        ],
        'Telefone': [
            'telefone', 'phone', 'mobile', 'cellular', 'communication', 'skype'
        ],
        'Alimentação': [
            'alimentação', 'food', 'restaurant', 'cafe', 'dining',
            'meal', 'coffee', 'bar', 'bakery', 'starbucks',
            'uber eats', 'pho', 'sushi', 'pizza', 'brewery', 'cuisine',
            'liquor', 'ramen', 'restaurante', 'lanchonete', 'burger',
            'breakfast', 'lunch', 'dinner', 'bistro', 'grill', 'eats',
            'winery', 'wine', 'kitchen', 'gastronom', 'beer', 'brewing',
            'ice cream', 'pizzeria', 'gelateria',
            'boteco', 'cachacaria', 'coxinha', 'chocolat', 'brew',
            'viet', 'tst', 'hortons', 'keg', 'poke', 'steak', 'bagel'
        ],
        'Vestuário': [
            'vestuário', 'clothing', 'clothes', 'fashion', 'apparel',
            'outlet', 'shoes'
        ],
        'Outro': [
            'outro', 'miscellaneous', 'various', 'unclassified',
            'amazon', 'amzn', 'temu', 'apple store', 'ebay', 'etsy',
            'buy', 'gadget', 'assorted', 'mixed', 'different',
            'varejopag', 'nagem'
        ],
        'Lazer': [
            'lazer', 'leisure', 'entertainment', 'fun', 'recreation',
            'hobby', 'netflix', 'spotify', 'primevideo', 'cinema', 'movie',
            'theater', 'concert', 'show', 'ticket', 'music',
            'playstation', 'cirque du soleil', 'cineplex', 'obaticket'
        ],
        'Transporte': [
            'transporte', 'transport', 'uber', 'taxi', 'bus',
            'parking', 'fuel', 'vehicle', 'lyft', 'transit', 'subway',
            'auto', 'rental', 'maintenance', 'e-bike', 'posto', 'chevron',
            'impark', 'easypark', 'indigo park', 'zipby', 'driver services', 'chv'
        ],
        'Educação': [
            'educação', 'education', 'school', 'student', 'college',
            'university', 'tuition', 'workshop', 'seminar', 'textbook',
            'abebooks'
        ],
        'Internet': [
            'internet', 'network', 'service provider', 'water'
        ],
        'Presente': [
            'presente', 'gift', 'donation', 'present', 'charity',
            'nonprofit', 'contribute', 'support', 'fundraiser',
            'cause', 'organization', 'foundation', 'give', 'donate'
        ],
        'Curso': [
            'curso', 'course', 'class', 'training', 'workshop',
            'seminar', 'tuition', 'education', 'learning'
        ],
        'Empréstimo': [
            'empréstimo', 'borrowing', 'student loan'
        ]
    },
    income: {
        'Trabalho': [
            'trabalho', 'work', 'salary', 'payroll', 'wage',
            'income', 'earning', 'job', 'reembolso',
            'salário', 'contribuição', 'compensation', 'pay',
            'direct deposit', 'employment', 'career', 'profession',
            'occupation'
        ],
        'Investimento': [
            'invest', 'investment', 'dividend', 'interest',
            'capital gain', 'stock', 'bond', 'fund', 'etf',
            'mutual', 'security', 'portfolio', 'asset', 'equity',
            'share', 'return'
        ],
        'Reembolso': [
            'temu', 'refund', 'return', 'reimbursement', 'cashback',
            'rebate', 'credit', 'chargeback', 'adjustment', 'correction',
            'reversal', 'cheque', 'pix', 'interac'
        ],
        'Outro': [
            'outro', 'other', 'miscellaneous', 'diversos',
            'additional', 'extra', 'ajuste', 'various', 'diverse',
            'assorted', 'mixed', 'different', 'payment', 'received',
            'thank you', 'freelance', 'contract', 'gig', 'project',
            'client', 'customer', 'service', 'consulting', 'consultation',
            'advisor', 'coach', 'mentor', 'tutor', 'instructor',
            'settlement', 'gift', 'present', 'donation', 'contribution',
            'support', 'assistance', 'aid', 'help', 'benefit', 'grant',
            'scholarship', 'fellowship', 'stipend', 'allowance'
        ]
    }
};

// Build a merged category-keyword map. If `personalKeywordsPath` is supplied,
// the module at that path is dynamically imported and its `personalKeywords`
// export is prepended per category so personal entries win under
// first-match-wins iteration. A missing/unreadable file is swallowed and the
// generic map is returned unchanged — fresh clones work with zero config.
//
// Paths are resolved relative to this module (the one doing the dynamic
// import), so callers in `js/` can pass `./personal-keywords.js` and tests
// under `tests/` can pass `../tests/fixtures/...`.
export async function loadCategoryKeywords(personalKeywordsPath) {
    let personalKeywords = { expense: {}, income: {} };
    if (personalKeywordsPath) {
        try {
            const mod = await import(personalKeywordsPath);
            if (mod.personalKeywords) personalKeywords = mod.personalKeywords;
        } catch {
            // personal keywords file not present — use empty overrides
        }
    }

    const merged = {};
    for (const type of Object.keys(genericKeywords)) {
        merged[type] = {};
        for (const category of Object.keys(genericKeywords[type])) {
            const personal = (personalKeywords?.[type]?.[category]) || [];
            merged[type][category] = [...personal, ...genericKeywords[type][category]];
        }
    }
    return merged;
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
    if (type === 'income') {
        for (const keywords of Object.values(categoryKeywords['expense'])) {
            for (const keyword of keywords) {
                if (description.includes(keyword)) {
                    return 'Reembolso';
                }
            }
        }
    }

    return UNCATEGORIZED;
}
