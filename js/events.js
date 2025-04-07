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
