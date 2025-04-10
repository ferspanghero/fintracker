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
        category: category || 'Outro',
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
        
        // Apply text filter
        if (currentFilter.textFilter) {
            const searchText = currentFilter.textFilter.toLowerCase();
            const matchesDescription = transaction.description.toLowerCase().includes(searchText);
            const matchesCategory = transaction.category.toLowerCase().includes(searchText);
            const matchesAccount = transaction.account.toLowerCase().includes(searchText);
            
            if (!(matchesDescription || matchesCategory || matchesAccount)) {
                return false;
            }
        }
        
        return true;
    });
}

// Delete selected transactions
function deleteSelectedTransactions() {
    const selectedRows = document.querySelectorAll('#transactions-body tr input[type="checkbox"]:checked');
    
    if (selectedRows.length === 0) {
        alert('No transactions selected.');
        return;
    }
    
    if (confirm(`Are you sure you want to delete ${selectedRows.length} transaction(s)?`)) {
        // Create an array of indices to remove
        const indicesToRemove = Array.from(selectedRows).map(row => 
            parseInt(row.closest('tr').getAttribute('data-index'), 10)
        );
        
        // Sort indices in descending order to avoid index shifting
        indicesToRemove.sort((a, b) => b - a);
        
        // Remove transactions
        indicesToRemove.forEach(index => {
            transactions.splice(index, 1);
        });
        
        // Save data
        saveData();
        
        // Render transactions
        renderTransactions();
        
        // Update summary
        updateSummary();
    }
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
