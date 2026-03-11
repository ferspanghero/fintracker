import { transactions, currentFilter } from './state.js';
import {
    transactionDateInput, transactionDescriptionInput, transactionAmountInput,
    transactionCategorySelect, transactionAccountSelect, newCategoryGroup,
    newCategoryNameInput, addTransactionModal, transactionsBody
} from './dom.js';
import { dateStrInputToLocalDate } from './utils.js';
import { categories, populateCategoryDropdowns, populateTransactionCategorySelect } from './categories.js';
import { saveData } from './storage.js';
import { renderTransactions, updateSummary } from './ui.js';

// Save data, re-render transactions and update summary
export function saveAndRefresh() {
    saveData();
    renderTransactions();
    updateSummary();
}

// Open add transaction modal
export function openAddTransactionModal() {
    // Reset form
    document.getElementById('transaction-form').reset();

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
export function handleAddTransaction(event) {
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

    saveAndRefresh();

    // Close modal
    addTransactionModal.style.display = 'none';
}

// Update transaction field
export function updateTransactionField(index, field, value) {
    const indices = new Set();

    // Includes edited transaction
    indices.add(index);

    // If there are selected rows, update all of them with the selected value
    const selectedRows = document.querySelectorAll('#transactions-body tr input[type="checkbox"]:checked');

    Array.from(selectedRows).forEach(row =>
        indices.add(parseInt(row.closest('tr').getAttribute('data-index'), 10))
    );

    // Update transactions
    indices.forEach(i => {
        if (field === 'date') {
            const parsed = dateStrInputToLocalDate(value);
            if (parsed) transactions[i].date = parsed;
        } else if (field === 'amount') {
            const parsed = parseFloat(value);
            if (!isNaN(parsed)) transactions[i].amount = parsed;
        } else {
            transactions[i][field] = value;
        }
    });

    saveAndRefresh();
}

// Delete transaction
export function deleteTransaction(index) {
    // Confirm deletion
    if (confirm('Are you sure you want to delete this transaction?')) {
        // Remove transaction
        transactions.splice(index, 1);

        saveAndRefresh();
    }
}

// Get filtered transactions
export function getFilteredTransactions() {
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
            const matchesDescription = (transaction.description || '').toLowerCase().includes(searchText);
            const matchesCategory = (transaction.category || '').toLowerCase().includes(searchText);
            const matchesAccount = (transaction.account || '').toLowerCase().includes(searchText);

            if (!(matchesDescription || matchesCategory || matchesAccount)) {
                return false;
            }
        }

        return true;
    });
}

// Delete selected transactions
export function deleteSelectedTransactions() {
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

        saveAndRefresh();
    }
}

// Confirm clear all transactions
export function confirmClearAll() {
    if (confirm('Are you sure you want to clear all transactions? This action cannot be undone.')) {
        // Clear transactions
        transactions.length = 0;

        saveAndRefresh();
    }
}
