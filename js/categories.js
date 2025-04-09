// Category-related constants and functions

// Default categories in Brazilian Portuguese
const defaultCategories = {
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
        'Empréstimo'
    ],
    income: [
        'Trabalho',
        'Outro'
    ]
};

// Initialize categories
let categories = JSON.parse(JSON.stringify(defaultCategories));

// Categorize transaction based on description
function categorizeTransaction(description, type) {
    description = description.toLowerCase();
    
    // Define comprehensive keywords for each category
    const categoryKeywords = {
        expense: {
            'Viagem': [
                'viagem', 'travel', 'trip', 'vacation', 'journey', 
                'hotel', 'flight', 'booking', 'airbnb', 'expedia', 
                'cruise', 'aircanada', 'empreend', 'turi', 'pix',
                'motel', 'lodging', 'accommodation', 'airline', 
                'holiday', 'tour', 'resort', 'localiza', 'recife'
            ],
            'Casa': [
                'casa', 'home', 'house', 'mortgage', 'rent', 'property', 
                'strata', 'hydro', 'utility', 'shaw', 'insurance', 
                'gallery', 'winners', 'handyman', 'apartment', 'condo', 
                'real estate', 'housing', 'maintenance', 'repair', 'improvement', 
                'furniture', 'decor'
            ],
            'Tarifa': [
                'tarifa', 'fee', 'charge', 'service', 'membership', 
                'adjusted cost base', 'bradesco prime', 'annual', 'monthly', 
                'interest', 'penalty', 'late', 'overdraft', 'atm', 'bank', 
                'financial', 'tax', 'subscription'
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
                'medicine', 'healthcare', 'insurance'
            ],
            'Mercado': [
                'merc', 'grocery', 'market', 'supermarket', 'costco', 'safeway', 
                'walmart', 'victoria hill market', 'persian baanou', 'canadian tire', 
                'home depot', 'dollar tree', 'iga', 'best season produce',
                'target', 'trader', 'whole foods', 'aldi', 'kroger', 'publix', 
                'shoprite', 'farm'
            ],
            'Telefone': [
                'telefone', 'phone', 'mobile', 'cellular', 
                'communication', 'fido mobile', 'skype', 'cell', 
                'provider', 'cable'
            ],
            'Alimentação': [
                'alimentação', 'food', 'restaurant', 'cafe', 'dining', 
                'meal', 'coffee', 'bar', 'bakery', 'starbucks', 
                'uber eats', 'pho', 'sushi', 'pizza', 'brewery', 
                'liquor', 'ramen', 'pub', 'restaurante', 'lanchonete',
                'burger', 'breakfast', 'lunch', 'dinner', 'bistro', 'grill', 'eats'
            ],
            'Vestuário': [
                'vestuário', 'clothing', 'clothes', 'fashion', 'wear', 
                'apparel', 'dress', 'arcteryx', 'winners', 'gap', 
                'diesel', 'jack & jones', 'old navy', 'renner', 
                'sport chek', 'accessory', 'mall', 'outlet', 'retail'
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
                'bus', 'train', 'parking', 'fuel', 'car', 'vehicle', 
                'e-bike', 'parking', 'impark', 'brentwood parking', 
                'lot', 'chv', 'lyft', 'gas', 'cab', 'transit', 
                'subway', 'toll', 'auto', 'rental', 'maintenance'
            ],
            'Educação': [
                'educação', 'education', 'school', 'course', 
                'learning', 'study', 'training', 'student', 
                'vancouver community college', 'criminal rec check',
                'college', 'university', 'tuition', 'class', 'workshop', 
                'seminar', 'book', 'textbook', 'material', 'supply'
            ],
            'Internet': [
                'internet', 'online', 'web', 'network', 'wifi',
                'cable', 'service provider', 'electric', 'water', 
                'gas', 'power', 'energy', 'utility'
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
            'Outro': [
                'outro', 'other', 'miscellaneous', 'diversos', 
                'additional', 'extra', 'ajuste', 'various', 'diverse', 
                'assorted', 'mixed', 'different', 'payment', 'received', 
                'thank you', 'freelance', 'contract', 'gig', 'project', 
                'client', 'customer', 'service', 'consulting', 'consultation', 
                'advisor', 'coach', 'mentor', 'tutor', 'instructor', 'refund', 
                'return', 'reimbursement', 'cashback', 'rebate', 'credit', 
                'chargeback', 'adjustment', 'correction', 'reversal', 'repayment', 
                'settlement', 'gift', 'present', 'donation', 'contribution', 
                'support', 'assistance', 'aid', 'help', 'benefit', 'grant', 
                'scholarship', 'fellowship', 'stipend', 'allowance'
            ]
        }
    };
    
    // Check for keywords in the appropriate type (expense or income)
    for (const [category, keywords] of Object.entries(categoryKeywords[type])) {
        for (const keyword of keywords) {
            if (description.toLowerCase().includes(keyword.toLowerCase())) {
                return category;
            }
        }
    }
    
    // Default categories if no match is found
    return type === 'Outro';
}

// Populate category dropdowns
function populateCategoryDropdowns() {
    // Clear category select
    categorySelect.innerHTML = '<option value="all">All Categories</option>';
    
    // Add expense categories
    const expenseOptgroup = document.createElement('optgroup');
    expenseOptgroup.label = 'Expenses';
    
    categories.expense.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        expenseOptgroup.appendChild(option);
    });
    
    categorySelect.appendChild(expenseOptgroup);
    
    // Add income categories
    const incomeOptgroup = document.createElement('optgroup');
    incomeOptgroup.label = 'Income';
    
    categories.income.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        incomeOptgroup.appendChild(option);
    });
    
    categorySelect.appendChild(incomeOptgroup);
}

// Populate transaction category select
function populateTransactionCategorySelect() {
    // Clear category select
    transactionCategorySelect.innerHTML = '<option value="">-- Select Category --</option>';
    
    // Get selected type
    const selectedType = document.querySelector('input[name="amount-type"]:checked').value;
    
    // Add categories based on type
    categories[selectedType].forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        transactionCategorySelect.appendChild(option);
    });
    
    // Add "Add New Category" option
    const newOption = document.createElement('option');
    newOption.value = 'new';
    newOption.textContent = '+ Add New Category';
    transactionCategorySelect.appendChild(newOption);
}

// Handle category select change in transaction form
function handleCategorySelectChange() {
    const selectedValue = transactionCategorySelect.value;
    
    // Show/hide new category input
    if (selectedValue === 'new') {
        newCategoryGroup.style.display = 'block';
    } else {
        newCategoryGroup.style.display = 'none';
    }
}

// Handle category filter change
function handleCategoryFilterChange() {
    currentFilter.category = categorySelect.value;
    
    // Apply filters and update view
    renderTransactions();
    updateSummary();
}
