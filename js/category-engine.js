// Pure categorization data and logic — no DOM dependencies.
// This module is imported by categories.js (UI layer) and by the benchmark utility.

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

// Define comprehensive keywords for each category
export const categoryKeywords = {
    expense: {
        'Viagem': [
            'viagem', 'travel', 'vacation', 'journey',
            'hotel', 'flight', 'booking', 'airbnb', 'expedia',
            'cruise', 'aircanada', 'empreend', 'turi', 'pix',
            'motel', 'lodging', 'accommodation', 'airline',
            'holiday', 'tour', 'resort', 'localiza', 'airalo',
            'marriott', 'air can'
        ],
        'Casa': [
            'home', 'house', 'mortgage', 'rent', 'property',
            'strata', 'hydro', 'utility', 'shaw', 'insurance',
            'gallery', 'winners', 'handyman', 'apartment', 'condo',
            'real estate', 'housing', 'maintenance', 'repair', 'improvement',
            'furniture', 'decor', 'parkside', 'rogers'
        ],
        'Tarifa': [
            'tarifa', 'charge', 'membership', 'adjusted cost base',
            'bradesco prime', 'annual', 'monthly', 'interest', 'penalty',
            'overdraft', 'atm', 'financial', 'tax',
             'subscription', 'doc/ted'
        ],
        'Dívida': [
            'dívida', 'debt', 'payment', 'bill', 'insurance',
            'loan', 'credit', 'plano de saúde', 'student loan', 'mortgage'
        ],
        'Saúde': [
            'saúde', 'health', 'medical', 'doctor', 'pharmacy',
            'clinic', 'therapy', 'wellness', 'enchante hair',
            'london drugs', 'shoppers', 'sally beauty',
            'exames', 'consulta', 'terapia', 'physician', 'hospital',
            'dental', 'dentist', 'vision', 'eye', 'drug', 'prescription',
            'medicine', 'healthcare', 'insurance', 'drogaria', 'shopbeauty',
            'pharma', 'lifelabs', 'farmacia', 'counseling',
            'h.bank', 'pague menos'
        ],
        'Mercado': [
            'merc', 'grocery', 'market', 'supermarket', 'costco', 'safeway',
            'walmart', 'victoria hill market', 'persian baanou', 'canadian tire',
            'home depot', 'dollar tree', 'iga', 'best season produce',
            'target', 'trader', 'whole foods', 'aldi', 'kroger', 'publix',
            'shoprite', 'choices', 'elements brazil', 'dollar store', 'nutri haven'
        ],
        'Telefone': [
            'telefone', 'phone', 'mobile', 'cellular',
            'communication', 'fido mobile', 'skype', 'cell',
            'provider', 'cable'
        ],
        'Alimentação': [
            'alimentação', 'food', 'restaurant', 'cafe', 'dining',
            'meal', 'coffee', 'bar', 'bakery', 'starbucks',
            'uber eats', 'pho', 'sushi', 'pizza', 'brewery', 'cuisine',
            'liquor', 'ramen', 'pub', 'restaurante', 'lanchonete',
            'burger', 'breakfast', 'lunch', 'dinner', 'bistro', 'grill', 'eats',
            'sao braz', 'viet', 'cachacaria', 'winery', 'kitchen', 'keg', 'poke',
            'hortons', 'gastronom', 'pie hole', 'beer', 'brewery', 'caffe mira',
            'brewing', 'ice cream', 'soccavo', 'pdv365', 'shipyards christmas',
            'chocolat'
        ],
        'Vestuário': [
            'vestuário', 'clothing', 'clothes', 'fashion', 'wear',
            'apparel', 'dress', 'arcteryx', 'winners', 'gap',
            'diesel', 'jack & jones', 'old navy', 'renner', 'h&m',
            'sport chek', 'accessory', 'mall', 'outlet', 'retail',
            'michaels', 'shoes', 'itx canada'
        ],
        'Outro': [
            'outro', 'other', 'miscellaneous', 'various',
            'unclassified', 'amazon', 'temu', 'apple store',
            'undetectable', 'airalo', 'varejopag', 'nagem',
            'ebay', 'etsy', 'purchase', 'buy', 'electronics',
            'device', 'gadget', 'assorted', 'mixed', 'different'
        ],
        'Lazer': [
            'lazer', 'leisure', 'entertainment', 'fun',
            'recreation', 'hobby', 'netflix', 'spotify',
            'cineplex', 'playstation', 'cirque du soleil',
            'obaticket', 'cinema', 'movie', 'theater', 'concert',
            'show', 'event', 'ticket', 'music', 'game',
            'subscription', 'streaming'
        ],
        'Transporte': [
            'transporte', 'transport', 'travel', 'uber', 'taxi',
            'bus', 'train', 'parking', 'fuel', 'vehicle',
            'e-bike', 'impark', 'brentwood parking',
            'lot', 'chv', 'lyft', 'transit',
            'subway', 'toll', 'auto', 'rental', 'maintenance', 'compass',
            'indigo park', 'icbc', 'easypark', 'chevron', 'posto'
        ],
        'Educação': [
            'educação', 'education', 'school', 'course',
            'learning', 'study', 'training', 'student',
            'vancouver community college', 'criminal rec check',
            'college', 'university', 'tuition', 'class', 'workshop',
            'seminar', 'textbook', 'material', 'anthropic'
        ],
        'Internet': [
            'internet', 'online', 'web', 'network', 'wifi',
            'cable', 'service provider', 'electric', 'water',
            'power', 'energy', 'utility'
        ],
        'Presente': [
            'presente', 'gift', 'donation', 'present', 'hallmark',
            'charity', 'nonprofit', 'contribute', 'support',
            'fundraiser', 'cause', 'organization', 'foundation',
            'give', 'donate'
        ],
        'Curso': [
            'curso', 'course', 'class', 'training', 'workshop',
            'seminar', 'tuition', 'education', 'learning'
        ],
        'Empréstimo': [
            'empréstimo', 'loan', 'credit', 'borrowing',
            'debt', 'interest', 'mortgage', 'student loan'
        ]
    },
    income: {
        'Trabalho': [
            'trabalho', 'work', 'salary', 'payroll', 'wage',
            'income', 'earning', 'job', 'amazon', 'reembolso',
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
            'reversal', 'interac', 'cineplex', 'cheque', 'pix'
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

// Categorize transaction based on description
export function categorizeTransaction(description, type) {
    if (!categoryKeywords[type]) return UNCATEGORIZED;

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
        for (const [category, keywords] of Object.entries(categoryKeywords['expense'])) {
            for (const keyword of keywords) {
                if (description.includes(keyword)) {
                    return 'Reembolso';
                }
            }
        }
    }

    return UNCATEGORIZED;
}
