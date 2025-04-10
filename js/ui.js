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
            <td class="editable" data-field="category">
                <select class="category-edit-dropdown">
                    ${categories[transaction.type].map(category => 
                        `<option value="${category}" ${category === (transaction.category || 'Sem Categoria') ? 'selected' : ''}>${category}</option>`
                    ).join('')}
                </select>
            </td>
            <td class="editable" data-field="account">${transaction.account}</td>
            <td>
                <div class="action-buttons">
                    <button class="delete-btn" onclick="deleteTransaction(${transactions.indexOf(transaction)})">Delete</button>
                </div>
            </td>
        `;

        row.querySelector('.category-edit-dropdown').addEventListener('change', (e) => {
            updateTransactionField(transactions.indexOf(transaction), "category", e.target.value);
        });
        
        // Add row to table
        transactionsBody.appendChild(row);
    });
    
    // Reset select all checkbox
    selectAllCheckbox.checked = false;
}

// Sort transactions
function sortTransactions(transactionsToSort) {
    return [...transactionsToSort].sort((a, b) => {
        // Get values safely with defaults for each field
        const field = currentSort.field;
        const isAsc = currentSort.direction === 'asc';
        
        // Handle different field types
        if (field === 'date') {
            const dateA = a.date?.getTime() || 0;
            const dateB = b.date?.getTime() || 0;
            return isAsc ? dateA - dateB : dateB - dateA;
        }
        
        if (field === 'amount') {
            // Some amounts may be absolute, so need to treat them all equally
            const amountA = (Math.abs(a.amount) ?? 0) * (a.type === 'expense' ? -1 : 1);
            const amountB = (Math.abs(b.amount) ?? 0) * (b.type === 'expense' ? -1 : 1);

            return isAsc ? amountA - amountB : amountB - amountA;
        }
        
        if (field === 'category') {
            const categoryA = a.category || '';
            const categoryB = b.category || '';
            return isAsc 
                ? categoryA.localeCompare(categoryB, 'pt-BR') 
                : categoryB.localeCompare(categoryA, 'pt-BR');
        }
        
        // Default case for any other string fields
        const strA = typeof a[field] === 'string' ? a[field] : '';
        const strB = typeof b[field] === 'string' ? b[field] : '';
        return isAsc 
            ? strA.localeCompare(strB, 'en-US') 
            : strB.localeCompare(strA, 'en-US');
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
