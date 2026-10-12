import {
    importBtn, dateRangeSelect, applyDateFilterBtn, categorySelect,
    textFilterInput, addTransactionBtn, exportCsvBtn, clearAllBtn,
    deleteSelectedBtn, selectAllCheckbox, transactionForm,
    transactionCategorySelect, importResultModal, importResultOkBtn
} from './dom.js';
import { initModals, closeModal } from './modal.js';
import { currentFilter } from './state.js';
import { handleImport, exportToCSV } from './import-export.js';
import { handleDateRangeChange, applyCustomDateFilter, renderTransactions, updateSummary, handleSort } from './ui.js';
import { handleCategoryFilterChange, handleCategorySelectChange, populateTransactionCategorySelect } from './categories.js';
import { openAddTransactionModal, confirmClearAll, deleteSelectedTransactions, handleAddTransaction } from './transactions.js';

// Add event listeners
export function addEventListeners() {
    // Import button
    importBtn.addEventListener('click', handleImport);

    // Date range filter
    dateRangeSelect.addEventListener('change', handleDateRangeChange);
    applyDateFilterBtn.addEventListener('click', applyCustomDateFilter);

    // Category filter
    categorySelect.addEventListener('change', handleCategoryFilterChange);

    // Text filter
    textFilterInput.addEventListener('input', () => {
        currentFilter.textFilter = textFilterInput.value;
        renderTransactions();
        updateSummary();
    });

    // Action buttons
    addTransactionBtn.addEventListener('click', openAddTransactionModal);
    exportCsvBtn.addEventListener('click', exportToCSV);
    clearAllBtn.addEventListener('click', confirmClearAll);
    deleteSelectedBtn.addEventListener('click', deleteSelectedTransactions);

    // Table sorting
    document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const field = th.getAttribute('data-sort');
            handleSort(field);
        });
    });

    // Select all checkbox
    selectAllCheckbox.addEventListener('change', (event) => {
        const checkboxes = document.querySelectorAll('.transaction-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = event.target.checked;
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

    // Import result dialog
    importResultOkBtn.addEventListener('click', () => closeModal(importResultModal));

    // × buttons, backdrop clicks and Escape for every dialog
    initModals();
}
