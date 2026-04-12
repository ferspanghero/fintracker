import { categorySelect, transactionCategorySelect, newCategoryGroup } from './dom.js';
import { currentFilter } from './state.js';
import { renderTransactions, updateSummary } from './ui.js';
import {
    defaultCategories,
    loadCategoryKeywords,
    categorizeTransaction as engineCategorize
} from './category-engine.js';

export { defaultCategories };

// Path (resolved relative to category-engine.js) to the optional gitignored
// personal-keyword overrides. Missing file is fine — loader falls back to
// generic keywords only.
const PERSONAL_KEYWORDS_PATH = './personal-keywords.js';

export const categoryKeywords = await loadCategoryKeywords(PERSONAL_KEYWORDS_PATH);

export function categorizeTransaction(description, type) {
    return engineCategorize(description, type, categoryKeywords);
}

// Initialize categories (mutable state for UI)
export let categories = JSON.parse(JSON.stringify(defaultCategories));

// Populate category dropdowns
export function populateCategoryDropdowns() {
    // Clear category select
    categorySelect.innerHTML = '<option value="all">All Categories</option>';

    // Add expense categories
    const expenseOptgroup = document.createElement('optgroup');
    expenseOptgroup.label = 'Expenses';

    categories.expense.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        expenseOptgroup.appendChild(option);
    });

    categorySelect.appendChild(expenseOptgroup);

    // Add income categories
    const incomeOptgroup = document.createElement('optgroup');
    incomeOptgroup.label = 'Income';

    categories.income.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        incomeOptgroup.appendChild(option);
    });

    categorySelect.appendChild(incomeOptgroup);
}

// Populate transaction category select
export function populateTransactionCategorySelect() {
    // Clear category select
    transactionCategorySelect.innerHTML = '<option value="">-- Select Category --</option>';

    // Get selected type
    const selectedType = document.querySelector('input[name="amount-type"]:checked').value;

    // Add categories based on type
    categories[selectedType].forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        transactionCategorySelect.appendChild(option);
    });

    // Add "Add New Category" option
    const newOption = document.createElement('option');
    newOption.value = 'new';
    newOption.textContent = '+ Add New Category';
    transactionCategorySelect.appendChild(newOption);
}

// Handle category select change in transaction form
export function handleCategorySelectChange() {
    const selectedValue = transactionCategorySelect.value;

    // Show/hide new category input
    if (selectedValue === 'new') {
        newCategoryGroup.style.display = 'block';
    } else {
        newCategoryGroup.style.display = 'none';
    }
}

// Handle category filter change
export function handleCategoryFilterChange() {
    currentFilter.category = categorySelect.value;

    // Apply filters and update view
    renderTransactions();
    updateSummary();
}
