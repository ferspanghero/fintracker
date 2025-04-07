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
