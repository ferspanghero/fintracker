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
            <td>
                <input type="checkbox" class="transaction-checkbox">
            </td>
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
    
    // Reset select all checkbox
    selectAllCheckbox.checked = false;
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
