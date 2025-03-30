// Global variables
let transactions = [];
let categories = {
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
let currentSort = { field: 'date', direction: 'desc' };
let currentFilter = { dateRange: 'all', startDate: null, endDate: null, category: 'all' };

// DOM Elements
const importBtn = document.getElementById('import-btn');
const fileInput = document.getElementById('csv-file');
const fileTypeSelect = document.getElementById('file-type');
const dateRangeSelect = document.getElementById('date-range');
const customDateContainer = document.getElementById('custom-date-container');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');
const applyDateFilterBtn = document.getElementById('apply-date-filter');
const categorySelect = document.getElementById('category-select');
const addTransactionBtn = document.getElementById('add-transaction-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const clearAllBtn = document.getElementById('clear-all-btn');
const transactionsTable = document.getElementById('transactions-table');
const transactionsBody = document.getElementById('transactions-body');
const totalIncomeElement = document.getElementById('total-income');
const totalExpensesElement = document.getElementById('total-expenses');
const netAmountElement = document.getElementById('net-amount');

// Modal Elements
const addTransactionModal = document.getElementById('add-transaction-modal');
const transactionForm = document.getElementById('transaction-form');
const transactionDateInput = document.getElementById('transaction-date');
const transactionDescriptionInput = document.getElementById('transaction-description');
const transactionAmountInput = document.getElementById('transaction-amount');
const transactionCategorySelect = document.getElementById('transaction-category');
const transactionAccountSelect = document.getElementById('transaction-account');
const newCategoryGroup = document.getElementById('new-category-group');
const newCategoryNameInput = document.getElementById('new-category-name');
const closeButtons = document.querySelectorAll('.close');

// Initialize the application
function init() {
    // Set today's date as default for the transaction form
    const today = new Date().toISOString().split('T')[0];
    transactionDateInput.value = today;
    
    // Load data from local storage
    loadData();
    
    // Populate category dropdowns
    populateCategoryDropdowns();
    
    // Render transactions
    renderTransactions();
    
    // Update summary
    updateSummary();
    
    // Add event listeners
    addEventListeners();
}

// Load data from local storage
function loadData() {
    // Load transactions
    const savedTransactions = localStorage.getItem('transactions');
    if (savedTransactions) {
        transactions = JSON.parse(savedTransactions);
        
        // Convert date strings to Date objects
        transactions.forEach(transaction => {
            transaction.date = new Date(transaction.date);
        });
    }
    
    // Load categories
    const savedCategories = localStorage.getItem('categories');
    if (savedCategories) {
        categories = JSON.parse(savedCategories);
    }
}

// Save data to local storage
function saveData() {
    localStorage.setItem('transactions', JSON.stringify(transactions));
    localStorage.setItem('categories', JSON.stringify(categories));
    
    // Also save to monthly files
    saveToMonthlyFiles();
}

// Save transactions to monthly files
function saveToMonthlyFiles() {
    // Group transactions by month
    const transactionsByMonth = {};
    
    transactions.forEach(transaction => {
        const date = new Date(transaction.date);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!transactionsByMonth[monthKey]) {
            transactionsByMonth[monthKey] = [];
        }
        
        transactionsByMonth[monthKey].push(transaction);
    });
    
    // Save each month's transactions to a file
    for (const [month, monthTransactions] of Object.entries(transactionsByMonth)) {
        const csvContent = convertTransactionsToCSV(monthTransactions);
        
        // In a real application, we would save this to a file
        // Since we're in a browser environment, we'll simulate this by storing in localStorage
        localStorage.setItem(`transactions_${month}.csv`, csvContent);
    }
}

// Add event listeners
function addEventListeners() {
    // Import button
    importBtn.addEventListener('click', handleImport);
    
    // Date range filter
    dateRangeSelect.addEventListener('change', handleDateRangeChange);
    applyDateFilterBtn.addEventListener('click', applyCustomDateFilter);
    
    // Category filter
    categorySelect.addEventListener('change', handleCategoryFilterChange);
    
    // Action buttons
    addTransactionBtn.addEventListener('click', openAddTransactionModal);
    exportCsvBtn.addEventListener('click', exportToCSV);
    clearAllBtn.addEventListener('click', confirmClearAll);
    
    // Table sorting
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.getAttribute('data-sort');
            handleSort(field);
        });
    });
    
    // Transaction form
    transactionForm.addEventListener('submit', handleAddTransaction);
    
    // Category select in transaction form
    transactionCategorySelect.addEventListener('change', handleCategorySelectChange);
    
    // Transaction type radio buttons
    document.querySelectorAll('input[name="amount-type"]').forEach(radio => {
        radio.addEventListener('change', () => {
            populateTransactionCategorySelect();
        });
    });
    
    // Close buttons for modals
    closeButtons.forEach(button => {
        button.addEventListener('click', () => {
            button.closest('.modal').style.display = 'none';
        });
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
    
    // Handle cell editing
    transactionsBody.addEventListener('click', handleCellClick);
    document.addEventListener('keydown', handleCellKeydown);
    document.addEventListener('click', handleDocumentClick);
}

// Handle import button click
function handleImport() {
    const files = fileInput.files;
    
    if (!files.length) {
        alert('Please select at least one file to import.');
        return;
    }
    
    // Disable import button during import
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';
    
    // Process files sequentially
    processFiles(files, 0, 0);
}

// Process files sequentially
function processFiles(files, index, totalImported) {
    // If all files have been processed
    if (index >= files.length) {
        // Re-enable import button
        importBtn.disabled = false;
        importBtn.textContent = 'Import';
        
        if (totalImported > 0) {
            // Save data
            saveData();
            
            // Render transactions
            renderTransactions();
            
            // Update summary
            updateSummary();
            
            alert(`Successfully imported ${totalImported} transactions from ${files.length} file(s).`);
        } else {
            alert('No transactions were imported. Please check the file formats.');
        }
        
        return;
    }
    
    // Get current file
    const file = files[index];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const contents = e.target.result;
        const fileType = fileTypeSelect.value;
        
        try {
            // Update import button text to show progress
            importBtn.textContent = `Importing (${index + 1}/${files.length})...`;
            
            const importedTransactions = parseCSV(contents, fileType);
            
            if (importedTransactions.length > 0) {
                // Add imported transactions to existing ones
                transactions = [...transactions, ...importedTransactions];
                
                // Process next file
                processFiles(files, index + 1, totalImported + importedTransactions.length);
            } else {
                console.warn(`No transactions imported from file: ${file.name}`);
                // Process next file
                processFiles(files, index + 1, totalImported);
            }
        } catch (error) {
            console.error(`Error importing file ${file.name}: ${error.message}`);
            // Process next file
            processFiles(files, index + 1, totalImported);
        }
    };
    
    reader.onerror = function() {
        console.error(`Error reading file ${file.name}`);
        // Process next file
        processFiles(files, index + 1, totalImported);
    };
    
    reader.readAsText(file);
}

// Parse CSV file based on file type
function parseCSV(csvContent, fileType) {
    const lines = csvContent.split('\n');
    const importedTransactions = [];
    
    // Auto-detect file type if set to auto
    if (fileType === 'auto') {
        fileType = detectFileType(lines[0]);
    }
    
    // Skip header row for most file types
    const startRow = (fileType === 'td') ? 0 : 1;
    
    for (let i = startRow; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
            let transaction;
            
            switch (fileType) {
                case 'fintracker':
                    transaction = parseFinTrackerTransaction(line);
                    break;
                case 'amex':
                    transaction = parseAmexTransaction(line);
                    break;
                case 'mastercard':
                    transaction = parseMastercardTransaction(line);
                    break;
                case 'simplii':
                    transaction = parseSimpliiTransaction(line);
                    break;
                case 'td':
                    transaction = parseTDTransaction(line);
                    break;
                case 'custom':
                    // For custom format, we'd need more information from the user
                    // This is a placeholder
                    transaction = parseCustomTransaction(line);
                    break;
                default:
                    throw new Error('Unknown file type');
            }
            
            if (transaction) {
                importedTransactions.push(transaction);
            }
        } catch (error) {
            console.error(`Error parsing line ${i + 1}: ${error.message}`);
        }
    }
    
    return importedTransactions;
}

// Parse FinTracker export format
function parseFinTrackerTransaction(line) {
    // Format: Date,Description,Amount,Type,Category,Account
    const parts = parseCSVLine(line);
    if (parts.length < 6) return null;
    
    const dateStr = parts[0];
    const description = parts[1].replace(/^"|"$/g, '').replace(/""/g, '"'); // Remove quotes and handle escaped quotes
    const amount = parseFloat(parts[2]);
    const type = parts[3].toLowerCase();
    const category = parts[4];
    const account = parts[5];
    
    // Parse date (format: YYYY-MM-DD)
    const date = parseDate(dateStr);
    
    // Add any new categories that don't exist yet
    if (category && !categories[type].includes(category)) {
        categories[type].push(category);
    }
    
    return {
        date,
        description,
        amount,
        type,
        category,
        account
    };
}

// Detect file type based on header row
function detectFileType(headerRow) {
    headerRow = headerRow.toLowerCase();
    
    if (headerRow.includes('date,description,amount,type,category,account')) {
        return 'fintracker';
    } else if (headerRow.includes('date,date processed,description,amount')) {
        return 'amex';
    } else if (headerRow.includes('description,type,card holder name,date,time,amount')) {
        return 'mastercard';
    } else if (headerRow.includes('date, transaction details, funds out, funds in')) {
        return 'simplii';
    } else {
        // TD doesn't have headers, so this is a fallback
        return 'td';
    }
}

// Parse American Express transaction
function parseAmexTransaction(line) {
    // Format: Date,Date Processed,Description,Amount
    const parts = parseCSVLine(line);
    if (parts.length < 4) return null;
    
    const dateStr = parts[0];
    const description = parts[2];
    const amount = parseFloat(parts[3]);
    
    // Parse date (format: DD-MMM-YY)
    const date = parseDate(dateStr);
    
    // Determine transaction type (negative amount = payment/income, positive = expense)
    const type = amount < 0 ? 'income' : 'expense';
    
    // Determine category based on description
    const category = categorizeTransaction(description, type);
    
    return {
        date,
        description,
        amount: Math.abs(amount),
        type,
        category,
        account: 'Amex'
    };
}

// Parse Mastercard transaction
function parseMastercardTransaction(line) {
    // Format: Description,Type,Card Holder Name,Date,Time,Amount
    const parts = parseCSVLine(line);
    if (parts.length < 6) return null;
    
    const description = parts[0];
    const transactionType = parts[1];
    const cardHolder = parts[2];
    const dateStr = parts[3];
    const amount = parseFloat(parts[5]);
    
    // Parse date (format: M/D/YYYY)
    const date = parseDate(dateStr);
    
    // Determine transaction type (PAYMENT = income, PURCHASE = expense)
    const type = transactionType === 'PAYMENT' ? 'income' : 'expense';
    
    // Determine category based on description
    const category = categorizeTransaction(description, type);
    
    return {
        date,
        description: `${description} (${cardHolder})`,
        amount: Math.abs(amount),
        type,
        category,
        account: 'Mastercard'
    };
}

// Parse Simplii transaction
function parseSimpliiTransaction(line) {
    // Format: Date, Transaction Details, Funds Out, Funds In
    const parts = parseCSVLine(line);
    if (parts.length < 4) return null;
    
    const dateStr = parts[0].trim();
    const description = parts[1].trim();
    const fundsOut = parts[2].trim();
    const fundsIn = parts[3].trim();
    
    // Parse date (format: M/D/YYYY)
    const date = parseDate(dateStr);
    
    // Determine amount and type
    let amount, type;
    if (fundsIn && parseFloat(fundsIn) > 0) {
        amount = parseFloat(fundsIn);
        type = 'income';
    } else {
        amount = parseFloat(fundsOut);
        type = 'expense';
    }
    
    // Determine category based on description
    const category = categorizeTransaction(description, type);
    
    return {
        date,
        description,
        amount,
        type,
        category,
        account: 'Simplii'
    };
}

// Parse TD transaction
function parseTDTransaction(line) {
    // Format: Date,Description,Amount Out,Amount In,Balance
    const parts = parseCSVLine(line);
    if (parts.length < 3) return null;
    
    const dateStr = parts[0];
    const description = parts[1];
    
    // TD format has separate columns for money out and in
    // If amount out is present, it's an expense
    // If amount in is present, it's income
    let amount, type;
    if (parts[2] && parseFloat(parts[2]) > 0) {
        amount = parseFloat(parts[2]);
        type = 'expense';
    } else if (parts[3] && parseFloat(parts[3]) > 0) {
        amount = parseFloat(parts[3]);
        type = 'income';
    } else {
        // Skip if no amount
        return null;
    }
    
    // Parse date (format: M/D/YYYY)
    const date = parseDate(dateStr);
    
    // Determine category based on description
    const category = categorizeTransaction(description, type);
    
    return {
        date,
        description,
        amount,
        type,
        category,
        account: 'TD'
    };
}

// Parse custom transaction format
function parseCustomTransaction(line) {
    // This is a placeholder for custom format parsing
    // In a real application, we would need more information from the user
    const parts = parseCSVLine(line);
    
    // Assuming format: Date,Description,Amount,Type
    if (parts.length < 3) return null;
    
    const dateStr = parts[0];
    const description = parts[1];
    const amount = parseFloat(parts[2]);
    const type = parts[3] ? parts[3].toLowerCase() : (amount < 0 ? 'income' : 'expense');
    
    // Parse date
    const date = parseDate(dateStr);
    
    // Determine category based on description
    const category = categorizeTransaction(description, type);
    
    return {
        date,
        description,
        amount: Math.abs(amount),
        type,
        category,
        account: 'Other'
    };
}

// Parse CSV line, handling quoted values
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

// Parse date from various formats
function parseDate(dateStr) {
    // Try to parse various date formats
    let date;
    
    // Format: DD-MMM-YY (e.g., 28-Feb-25)
    if (dateStr.match(/^\d{1,2}-[A-Za-z]{3}-\d{2}$/)) {
        const parts = dateStr.split('-');
        const day = parseInt(parts[0], 10);
        const monthStr = parts[1];
        const year = 2000 + parseInt(parts[2], 10); // Assuming 20xx for year
        
        const months = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        
        date = new Date(year, months[monthStr], day);
    }
    // Format: M/D/YYYY (e.g., 2/26/2025)
    else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const parts = dateStr.split('/');
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        date = new Date(year, month, day);
    }
    // Format: YYYY-MM-DD (e.g., 2025-02-26)
    else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = dateStrInputToLocalDate(dateStr);
    }
    // Format: M/D/YYYY (e.g., 2/26/2025) - alternative format
    else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
        const parts = dateStr.split('/');
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = 2000 + parseInt(parts[2], 10); // Assuming 20xx for year
        
        date = new Date(year, month, day);
    }
    // Format: MM/DD/YYYY (e.g., 02/26/2025)
    else if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const parts = dateStr.split('/');
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        date = new Date(year, month, day);
    }
    // Format: YYYY/MM/DD (e.g., 2025/02/26)
    else if (dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
        const parts = dateStr.split('/');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        
        date = new Date(year, month, day);
    }
    // If all else fails, try the built-in date parser
    else {
        date = new Date(dateStr);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        console.error(`Invalid date: ${dateStr}`);
        // Default to today if date is invalid
        date = new Date();
    }
    
    return date;
}

function dateStrInputToLocalDate(dateStrInput) {
    // Format: YYYY-MM-DD (e.g., 2025-02-26)
    const [year, month, day] = dateStrInput.split('-');
    return new Date(year, month - 1, day); // Uses local time (month is zero-indexed)
}

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

// Handle date range change
function handleDateRangeChange() {
    const selectedRange = dateRangeSelect.value;
    
    // Show/hide custom date range inputs
    if (selectedRange === 'custom') {
        customDateContainer.style.display = 'flex';
    } else {
        customDateContainer.style.display = 'none';
        
        // Apply the selected date range
        currentFilter.dateRange = selectedRange;
        currentFilter.startDate = null;
        currentFilter.endDate = null;
        
        // Set date range based on selection
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        
        switch (selectedRange) {
            case 'current-month':
                currentFilter.startDate = new Date(currentYear, currentMonth, 1);
                currentFilter.endDate = new Date(currentYear, currentMonth + 1, 0);
                break;
            case 'last-month':
                currentFilter.startDate = new Date(currentYear, currentMonth - 1, 1);
                currentFilter.endDate = new Date(currentYear, currentMonth, 0);
                break;
            case 'current-year':
                currentFilter.startDate = new Date(currentYear, 0, 1);
                currentFilter.endDate = new Date(currentYear, 11, 31);
                break;
            case 'all':
                // No date filters
                break;
        }
        
        // Apply filters and update view
        renderTransactions();
        updateSummary();
    }
}

// Apply custom date filter
function applyCustomDateFilter() {
    const startDate = startDateInput.value ? dateStrInputToLocalDate(startDateInput.value) : null;
    const endDate = endDateInput.value ? dateStrInputToLocalDate(endDateInput.value) : null;
    
    if (startDate && endDate && startDate > endDate) {
        alert('Start date cannot be after end date.');
        return;
    }
    
    currentFilter.dateRange = 'custom';
    currentFilter.startDate = startDate;
    currentFilter.endDate = endDate;
    
    // Apply filters and update view
    renderTransactions();
    updateSummary();
}

// Handle category filter change
function handleCategoryFilterChange() {
    currentFilter.category = categorySelect.value;
    
    // Apply filters and update view
    renderTransactions();
    updateSummary();
}

// Handle sort
function handleSort(field) {
    // Toggle sort direction if same field is clicked
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
    }
    
    // Update sort icons
    updateSortIcons();
    
    // Re-render transactions with new sort
    renderTransactions();
}

// Update sort icons
function updateSortIcons() {
    // Clear all sort icons
    document.querySelectorAll('.sort-icon').forEach(icon => {
        icon.textContent = '';
    });
    
    // Set the icon for the current sort field
    const th = document.querySelector(`th[data-sort="${currentSort.field}"]`);
    if (th) {
        const icon = th.querySelector('.sort-icon');
        icon.textContent = currentSort.direction === 'asc' ? '▲' : '▼';
    }
}

// Open add transaction modal
function openAddTransactionModal() {
    // Reset form
    transactionForm.reset();
    
    // Set today's date as default
    const today = new Date().toISOString().split('T')[0];
    transactionDateInput.value = today;
    
    // Hide new category input
    newCategoryGroup.style.display = 'none';
    
    // Populate category dropdown
    populateTransactionCategorySelect();
    
    // Show modal
    addTransactionModal.style.display = 'block';
}

// Handle add transaction form submission
function handleAddTransaction(event) {
    event.preventDefault();
    
    // Get form values
    const date = dateStrInputToLocalDate(transactionDateInput.value);
    const description = transactionDescriptionInput.value;
    const amount = parseFloat(transactionAmountInput.value);
    const type = document.querySelector('input[name="amount-type"]:checked').value;
    let category = transactionCategorySelect.value;
    const account = transactionAccountSelect.value;
    
    // Handle new category
    if (category === 'new') {
        const newCategoryName = newCategoryNameInput.value.trim();
        const categoryType = document.querySelector('input[name="category-type"]:checked').value;
        
        if (!newCategoryName) {
            alert('Please enter a name for the new category.');
            return;
        }
        
        // Add new category
        if (!categories[categoryType].includes(newCategoryName)) {
            categories[categoryType].push(newCategoryName);
            saveData();
            populateCategoryDropdowns();
        }
        
        category = newCategoryName;
    }
    
    // Create new transaction
    const newTransaction = {
        date,
        description,
        amount,
        type,
        category: category || (type === 'expense' ? 'Other Expenses' : 'Other Income'),
        account
    };
    
    // Add to transactions array
    transactions.push(newTransaction);
    
    // Save data
    saveData();
    
    // Render transactions
    renderTransactions();
    
    // Update summary
    updateSummary();
    
    // Close modal
    addTransactionModal.style.display = 'none';
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

// Export to CSV
function exportToCSV() {
    // Get filtered transactions
    const filteredTransactions = getFilteredTransactions();
    
    // Convert to CSV
    const csvContent = convertTransactionsToCSV(filteredTransactions);
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Set link properties
    link.href = url;
    link.download = `fintracker_export_${new Date().toISOString().split('T')[0]}.csv`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Convert transactions to CSV format
function convertTransactionsToCSV(transactionsToExport) {
    // Define CSV header
    const header = 'Date,Description,Amount,Type,Category,Account\n';
    
    // Convert each transaction to CSV row
    const rows = transactionsToExport.map(transaction => {
        const date = transaction.date.toISOString().split('T')[0];
        const description = `"${transaction.description.replace(/"/g, '""')}"`;
        const amount = transaction.amount;
        const type = transaction.type;
        const category = transaction.category;
        const account = transaction.account;
        
        return `${date},${description},${amount},${type},${category},${account}`;
    }).join('\n');
    
    return header + rows;
}

// Confirm clear all transactions
function confirmClearAll() {
    if (confirm('Are you sure you want to clear all transactions? This action cannot be undone.')) {
        // Clear transactions
        transactions = [];
        
        // Save data
        saveData();
        
        // Render transactions
        renderTransactions();
        
        // Update summary
        updateSummary();
    }
}

// Handle cell click for inline editing
function handleCellClick(event) {
    const cell = event.target.closest('td');
    
    // Only handle clicks on editable cells
    if (!cell || !cell.classList.contains('editable')) {
        return;
    }
    
    // Get transaction index and field
    const row = cell.parentElement;
    const index = parseInt(row.getAttribute('data-index'), 10);
    const field = cell.getAttribute('data-field');
    
    // Create input element
    const input = document.createElement('input');
    
    // Set input properties based on field type
    if (field === 'date') {
        input.type = 'date';
        input.value = transactions[index].date.toISOString().split('T')[0];
    } else if (field === 'amount') {
        input.type = 'number';
        input.step = '0.01';
        input.value = transactions[index].amount;
    } else if (field === 'category') {
        // For category, we'll use a select element instead
        const select = document.createElement('select');
        
        // Add options based on transaction type
        const type = transactions[index].type;
        
        // Add empty option
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-- Select Category --';
        select.appendChild(emptyOption);
        
        // Add category options
        categories[type].forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = category;
            
            if (category === transactions[index].category) {
                option.selected = true;
            }
            
            select.appendChild(option);
        });
        
        // Replace input with select
        input.replaceWith(select);
        select.classList.add('cell-input');
        select.setAttribute('data-index', index);
        select.setAttribute('data-field', field);
        select.setAttribute('data-original', transactions[index].category);
        select.focus();
        
        // Handle select change
        select.addEventListener('change', () => {
            updateTransactionField(index, field, select.value);
            select.remove();
        });
        
        // Handle select blur
        select.addEventListener('blur', () => {
            select.remove();
        });
        
        return;
    } else {
        input.type = 'text';
        input.value = transactions[index][field];
    }
    
    // Set common input properties
    input.classList.add('cell-input');
    input.setAttribute('data-index', index);
    input.setAttribute('data-field', field);
    input.setAttribute('data-original', input.value);
    
    // Add input to cell
    cell.appendChild(input);
    input.focus();
    
    // Select all text
    input.select();
}

// Handle keydown events for cell editing
function handleCellKeydown(event) {
    const input = event.target.closest('.cell-input');
    
    if (!input) {
        return;
    }
    
    const index = parseInt(input.getAttribute('data-index'), 10);
    const field = input.getAttribute('data-field');
    const originalValue = input.getAttribute('data-original');
    
    // Handle Enter key
    if (event.key === 'Enter') {
        event.preventDefault();
        
        // Update transaction
        updateTransactionField(index, field, input.value);
        
        // Remove input
        input.remove();
    }
    // Handle Escape key
    else if (event.key === 'Escape') {
        event.preventDefault();
        
        // Revert to original value
        input.remove();
    }
}

// Handle document click for closing cell editing
function handleDocumentClick(event) {
    const input = document.querySelector('.cell-input');
    
    if (!input || input.contains(event.target) || event.target === input) {
        return;
    }
    
    const index = parseInt(input.getAttribute('data-index'), 10);
    const field = input.getAttribute('data-field');
    
    // Update transaction
    updateTransactionField(index, field, input.value);
    
    // Remove input
    input.remove();
}

// Update transaction field
function updateTransactionField(index, field, value) {
    // Get transaction
    const transaction = transactions[index];
    
    // Update field based on type
    if (field === 'date') {
        transaction.date = new Date(value);
    } else if (field === 'amount') {
        transaction.amount = parseFloat(value);
    } else {
        transaction[field] = value;
    }
    
    // Save data
    saveData();
    
    // Render transactions
    renderTransactions();
    
    // Update summary
    updateSummary();
}

// Delete transaction
function deleteTransaction(index) {
    // Confirm deletion
    if (confirm('Are you sure you want to delete this transaction?')) {
        // Remove transaction
        transactions.splice(index, 1);
        
        // Save data
        saveData();
        
        // Render transactions
        renderTransactions();
        
        // Update summary
        updateSummary();
    }
}

// Get filtered transactions
function getFilteredTransactions() {
    return transactions.filter(transaction => {
        // Apply date filter
        if (currentFilter.startDate && transaction.date < currentFilter.startDate) {
            return false;
        }
        
        if (currentFilter.endDate) {
            // Set end date to end of day
            const endDate = new Date(currentFilter.endDate);
            endDate.setHours(23, 59, 59, 999);
            
            if (transaction.date > endDate) {
                return false;
            }
        }
        
        // Apply category filter
        if (currentFilter.category !== 'all' && transaction.category !== currentFilter.category) {
            return false;
        }
        
        return true;
    });
}

// Render transactions
function renderTransactions() {
    // Clear table
    transactionsBody.innerHTML = '';
    
    // Get filtered transactions
    const filteredTransactions = getFilteredTransactions();
    
    // Sort transactions
    const sortedTransactions = sortTransactions(filteredTransactions);
    
    // Render each transaction
    sortedTransactions.forEach((transaction, index) => {
        const row = document.createElement('tr');
        row.setAttribute('data-index', transactions.indexOf(transaction));
        
        // Format date
        const dateFormatted = transaction.date.toLocaleDateString();
        
        // Format amount
        const amountFormatted = transaction.amount.toFixed(2);
        const amountClass = transaction.type === 'income' ? 'positive' : 'negative';
        const amountDisplay = transaction.type === 'income' ? `$${amountFormatted}` : `-$${amountFormatted}`;
        
        // Create cells
        row.innerHTML = `
            <td class="editable" data-field="date">${dateFormatted}</td>
            <td class="editable" data-field="description">${transaction.description}</td>
            <td class="editable ${amountClass}" data-field="amount">${amountDisplay}</td>
            <td class="editable" data-field="category">${transaction.category || 'Uncategorized'}</td>
            <td class="editable" data-field="account">${transaction.account}</td>
            <td>
                <div class="action-buttons">
                    <button class="delete-btn" onclick="deleteTransaction(${transactions.indexOf(transaction)})">Delete</button>
                </div>
            </td>
        `;
        
        // Add row to table
        transactionsBody.appendChild(row);
    });
}

// Sort transactions
function sortTransactions(transactionsToSort) {
    return [...transactionsToSort].sort((a, b) => {
        let valueA, valueB;
        
        // Get values based on field
        switch (currentSort.field) {
            case 'date':
                valueA = a.date.getTime();
                valueB = b.date.getTime();
                break;
            case 'amount':
                valueA = a.amount;
                valueB = b.amount;
                break;
            default:
                valueA = a[currentSort.field];
                valueB = b[currentSort.field];
                
                // Handle string comparison
                if (typeof valueA === 'string' && typeof valueB === 'string') {
                    return currentSort.direction === 'asc'
                        ? valueA.localeCompare(valueB)
                        : valueB.localeCompare(valueA);
                }
        }
        
        // Compare values
        return currentSort.direction === 'asc'
            ? valueA - valueB
            : valueB - valueA;
    });
}

// Update summary
function updateSummary() {
    // Get filtered transactions
    const filteredTransactions = getFilteredTransactions();
    
    // Calculate totals
    let totalIncome = 0;
    let totalExpenses = 0;
    
    filteredTransactions.forEach(transaction => {
        if (transaction.type === 'income') {
            totalIncome += transaction.amount;
        } else {
            totalExpenses += transaction.amount;
        }
    });
    
    const netAmount = totalIncome - totalExpenses;
    
    // Update summary elements
    totalIncomeElement.textContent = `$${totalIncome.toFixed(2)}`;
    totalExpensesElement.textContent = `$${totalExpenses.toFixed(2)}`;
    netAmountElement.textContent = `$${netAmount.toFixed(2)}`;
    
    // Set net amount color
    netAmountElement.className = netAmount >= 0 ? 'positive' : 'negative';
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

// Initialize the application
document.addEventListener('DOMContentLoaded', init);
