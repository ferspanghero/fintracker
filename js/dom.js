// DOM Elements
export let importBtn;
export let fileInput;
export let fileTypeSelect;
export let dateRangeSelect;
export let customDateContainer;
export let startDateInput;
export let endDateInput;
export let applyDateFilterBtn;
export let categorySelect;
export let addTransactionBtn;
export let exportCsvBtn;
export let clearAllBtn;
export let transactionsTable;
export let transactionsBody;
export let totalIncomeElement;
export let totalExpensesElement;
export let netAmountElement;

// Modal Elements
export let addTransactionModal;
export let transactionForm;
export let transactionDateInput;
export let transactionDescriptionInput;
export let transactionAmountInput;
export let transactionCategorySelect;
export let transactionAccountSelect;
export let newCategoryGroup;
export let newCategoryNameInput;
export let closeButtons;

// New filter elements
export let textFilterInput;
export let deleteSelectedBtn;
export let selectAllCheckbox;

export function refreshDom() {
    importBtn = document.getElementById('import-btn');
    fileInput = document.getElementById('csv-file');
    fileTypeSelect = document.getElementById('file-type');
    dateRangeSelect = document.getElementById('date-range');
    customDateContainer = document.getElementById('custom-date-container');
    startDateInput = document.getElementById('start-date');
    endDateInput = document.getElementById('end-date');
    applyDateFilterBtn = document.getElementById('apply-date-filter');
    categorySelect = document.getElementById('category-select');
    addTransactionBtn = document.getElementById('add-transaction-btn');
    exportCsvBtn = document.getElementById('export-csv-btn');
    clearAllBtn = document.getElementById('clear-all-btn');
    transactionsTable = document.getElementById('transactions-table');
    transactionsBody = document.getElementById('transactions-body');
    totalIncomeElement = document.getElementById('total-income');
    totalExpensesElement = document.getElementById('total-expenses');
    netAmountElement = document.getElementById('net-amount');
    addTransactionModal = document.getElementById('add-transaction-modal');
    transactionForm = document.getElementById('transaction-form');
    transactionDateInput = document.getElementById('transaction-date');
    transactionDescriptionInput = document.getElementById('transaction-description');
    transactionAmountInput = document.getElementById('transaction-amount');
    transactionCategorySelect = document.getElementById('transaction-category');
    transactionAccountSelect = document.getElementById('transaction-account');
    newCategoryGroup = document.getElementById('new-category-group');
    newCategoryNameInput = document.getElementById('new-category-name');
    closeButtons = document.querySelectorAll('.close');
    textFilterInput = document.getElementById('text-filter');
    deleteSelectedBtn = document.getElementById('delete-selected-btn');
    selectAllCheckbox = document.getElementById('select-all-checkbox');
}

refreshDom();
