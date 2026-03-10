import { beforeEach } from 'vitest';
import { HTML_FIXTURE } from './dom-fixture.js';
import path from 'path';
import fs from 'fs';
import vm from 'vm';

const jsDir = path.resolve(__dirname, '../../js');

// Helper to load a JS file by evaluating it in the global context.
// Mimics how <script> tags work in the browser: all top-level declarations
// become globals. We convert const/let to var because vm.runInThisContext()
// scopes const/let per-call, unlike browser <script> tags which share a
// global lexical environment.
function loadScript(filename) {
    const filePath = path.join(jsDir, filename);
    const code = fs.readFileSync(filePath, 'utf-8');
    const transformed = code.replace(/^(const|let) /gm, 'var ');
    vm.runInThisContext(transformed, { filename: filePath });
}

// Inject DOM fixture before loading any scripts that reference DOM elements
document.body.innerHTML = HTML_FIXTURE;

// Load source files in dependency order (matching index.html script tag order)
loadScript('utils.js');
loadScript('dom.js');
loadScript('categories.js');
loadScript('storage.js');
loadScript('transactions.js');
loadScript('ui.js');
loadScript('import-export.js');
loadScript('events.js');
loadScript('main.js');

// Store default categories for reset
const _defaultCategoriesSnapshot = JSON.parse(JSON.stringify(globalThis.defaultCategories));

// Reset mutable global state before each test
beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = HTML_FIXTURE;

    // Re-cache DOM references (dom.js runs at load time, need to refresh after innerHTML reset)
    globalThis.importBtn = document.getElementById('import-btn');
    globalThis.fileInput = document.getElementById('csv-file');
    globalThis.fileTypeSelect = document.getElementById('file-type');
    globalThis.dateRangeSelect = document.getElementById('date-range');
    globalThis.customDateContainer = document.getElementById('custom-date-container');
    globalThis.startDateInput = document.getElementById('start-date');
    globalThis.endDateInput = document.getElementById('end-date');
    globalThis.applyDateFilterBtn = document.getElementById('apply-date-filter');
    globalThis.categorySelect = document.getElementById('category-select');
    globalThis.addTransactionBtn = document.getElementById('add-transaction-btn');
    globalThis.exportCsvBtn = document.getElementById('export-csv-btn');
    globalThis.clearAllBtn = document.getElementById('clear-all-btn');
    globalThis.transactionsTable = document.getElementById('transactions-table');
    globalThis.transactionsBody = document.getElementById('transactions-body');
    globalThis.totalIncomeElement = document.getElementById('total-income');
    globalThis.totalExpensesElement = document.getElementById('total-expenses');
    globalThis.netAmountElement = document.getElementById('net-amount');
    globalThis.addTransactionModal = document.getElementById('add-transaction-modal');
    globalThis.transactionForm = document.getElementById('transaction-form');
    globalThis.transactionDateInput = document.getElementById('transaction-date');
    globalThis.transactionDescriptionInput = document.getElementById('transaction-description');
    globalThis.transactionAmountInput = document.getElementById('transaction-amount');
    globalThis.transactionCategorySelect = document.getElementById('transaction-category');
    globalThis.transactionAccountSelect = document.getElementById('transaction-account');
    globalThis.newCategoryGroup = document.getElementById('new-category-group');
    globalThis.newCategoryNameInput = document.getElementById('new-category-name');
    globalThis.closeButtons = document.querySelectorAll('.close');
    globalThis.textFilterInput = document.getElementById('text-filter');
    globalThis.deleteSelectedBtn = document.getElementById('delete-selected-btn');
    globalThis.selectAllCheckbox = document.getElementById('select-all-checkbox');

    // Reset data state
    globalThis.transactions = [];
    globalThis.currentSort = { field: 'date', direction: 'desc' };
    globalThis.currentFilter = { dateRange: 'all', startDate: null, endDate: null, category: 'all', textFilter: '' };
    globalThis.categories = JSON.parse(JSON.stringify(_defaultCategoriesSnapshot));

    // Clear localStorage
    localStorage.clear();
});
