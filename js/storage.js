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
