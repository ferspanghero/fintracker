// Category-related constants and functions

// Default categories
const defaultCategories = {
    expense: [
        'Food & Dining', 
        'Groceries', 
        'Transportation', 
        'Housing', 
        'Utilities', 
        'Entertainment', 
        'Shopping', 
        'Travel', 
        'Healthcare', 
        'Personal Care',
        'Education',
        'Gifts & Donations',
        'Fees & Charges'
    ],
    income: [
        'Salary', 
        'Freelance', 
        'Investments', 
        'Refunds', 
        'Gifts', 
        'Other Income'
    ]
};

// Initialize categories
let categories = JSON.parse(JSON.stringify(defaultCategories));

// Categorize transaction based on description
function categorizeTransaction(description, type) {
    description = description.toLowerCase();
    
    // Define keywords for each category
    const categoryKeywords = {
        expense: {
            'Food & Dining': ['restaurant', 'cafe', 'coffee', 'food', 'dining', 'pizza', 'burger', 'sushi', 'meal', 'breakfast', 'lunch', 'dinner', 'bakery', 'bistro', 'grill', 'bar', 'pub'],
            'Groceries': ['grocery', 'supermarket', 'market', 'food', 'safeway', 'walmart', 'costco', 'target', 'trader', 'whole foods', 'aldi', 'kroger', 'publix', 'shoprite', 'farm'],
            'Transportation': ['gas', 'fuel', 'uber', 'lyft', 'taxi', 'cab', 'transit', 'train', 'subway', 'bus', 'parking', 'toll', 'car', 'auto', 'vehicle', 'rental', 'maintenance'],
            'Housing': ['rent', 'mortgage', 'property', 'home', 'apartment', 'condo', 'house', 'real estate', 'housing', 'maintenance', 'repair', 'improvement', 'furniture', 'decor'],
            'Utilities': ['electric', 'water', 'gas', 'power', 'energy', 'utility', 'internet', 'cable', 'phone', 'mobile', 'cell', 'bill', 'service', 'provider', 'shaw'],
            'Entertainment': ['movie', 'theater', 'cinema', 'concert', 'show', 'event', 'ticket', 'netflix', 'spotify', 'music', 'game', 'subscription', 'streaming', 'entertainment'],
            'Shopping': ['amazon', 'ebay', 'etsy', 'shop', 'store', 'retail', 'purchase', 'buy', 'mall', 'outlet', 'clothing', 'apparel', 'accessory', 'electronics', 'device', 'gadget'],
            'Travel': ['hotel', 'motel', 'lodging', 'accommodation', 'airbnb', 'flight', 'airline', 'travel', 'trip', 'vacation', 'holiday', 'tour', 'cruise', 'resort', 'booking', 'expedia', 'localiza'],
            'Healthcare': ['doctor', 'physician', 'medical', 'health', 'hospital', 'clinic', 'dental', 'dentist', 'vision', 'eye', 'pharmacy', 'drug', 'prescription', 'medicine', 'healthcare', 'insurance'],
            'Personal Care': ['salon', 'spa', 'hair', 'beauty', 'cosmetic', 'makeup', 'skincare', 'grooming', 'barber', 'stylist', 'nail', 'massage', 'therapy', 'wellness', 'fitness', 'gym', 'workout'],
            'Education': ['school', 'college', 'university', 'tuition', 'education', 'course', 'class', 'workshop', 'seminar', 'training', 'book', 'textbook', 'material', 'supply', 'student', 'loan'],
            'Gifts & Donations': ['gift', 'present', 'donation', 'charity', 'nonprofit', 'contribute', 'support', 'fundraiser', 'cause', 'organization', 'foundation', 'give', 'donate'],
            'Fees & Charges': ['fee', 'charge', 'service', 'membership', 'subscription', 'annual', 'monthly', 'interest', 'penalty', 'late', 'overdraft', 'atm', 'bank', 'financial', 'tax']
        },
        income: {
            'Salary': ['salary', 'payroll', 'wage', 'income', 'earning', 'compensation', 'pay', 'direct deposit', 'employment', 'job', 'work', 'career', 'profession', 'occupation', 'amazon'],
            'Freelance': ['freelance', 'contract', 'gig', 'project', 'client', 'customer', 'service', 'consulting', 'consultation', 'advisor', 'coach', 'mentor', 'tutor', 'instructor'],
            'Investments': ['investment', 'dividend', 'interest', 'capital gain', 'stock', 'bond', 'fund', 'etf', 'mutual', 'security', 'portfolio', 'asset', 'equity', 'share', 'return'],
            'Refunds': ['refund', 'return', 'reimbursement', 'cashback', 'rebate', 'credit', 'chargeback', 'adjustment', 'correction', 'reversal', 'repayment', 'settlement'],
            'Gifts': ['gift', 'present', 'donation', 'contribution', 'support', 'assistance', 'aid', 'help', 'benefit', 'grant', 'scholarship', 'fellowship', 'stipend', 'allowance'],
            'Other Income': ['other', 'miscellaneous', 'various', 'diverse', 'assorted', 'mixed', 'different', 'payment', 'received', 'thank you']
        }
    };
    
    // Check for payment keywords
    if (description.includes('payment') && description.includes('thank you')) {
        return 'Other Income';
    }
    
    // Check for keywords in the appropriate type (expense or income)
    for (const [category, keywords] of Object.entries(categoryKeywords[type])) {
        for (const keyword of keywords) {
            if (description.includes(keyword)) {
                return category;
            }
        }
    }
    
    // Default categories if no match is found
    return type === 'expense' ? 'Other Expenses' : 'Other Income';
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
