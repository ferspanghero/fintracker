// Global variables
let transactions = [];
let currentSort = { field: 'date', direction: 'desc' };
let currentFilter = { dateRange: 'all', startDate: null, endDate: null, category: 'all', textFilter: '' };

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

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
