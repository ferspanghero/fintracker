import { categorySelect, transactionCategorySelect, newCategoryGroup } from './dom.js';
import { currentFilter, settings } from './state.js';
import { renderTransactions, updateSummary } from './ui.js';
import {
    UNCATEGORIZED,
    loadCategoryKeywords,
    restrictKeywords,
    categorizeTransaction as engineCategorize
} from './category-engine.js';

// Path (resolved relative to the js/ loaders: category-engine.js and
// ignore-rules.js) to the optional gitignored personal-keyword overrides.
// Missing file is fine — loaders fall back to generic entries only.
export const PERSONAL_KEYWORDS_PATH = './personal-keywords.js';

// `await` at the top level of a module (top-level await) is intentional here.
// `loadCategoryKeywords` is async because it does a dynamic `import()` of the
// optional gitignored personal-keywords file — that returns a Promise. By
// awaiting at module scope, we guarantee `categoryKeywords` is fully populated
// before any code that imports this module can read it; the module system
// enforces the ordering for free, so callers never see a half-loaded value.
//
// Trade-off: this module's evaluation is paused until the await resolves,
// which can finish AFTER the browser fires DOMContentLoaded. main.js handles
// that race explicitly via a `document.readyState` branch — keep them in sync
// if you ever change this.
export const categoryKeywords = await loadCategoryKeywords(PERSONAL_KEYWORDS_PATH);

/**
 * Categorizes against the Settings category list: keyword routes to categories
 * the user doesn't have are skipped, and the engine's Reembolso fallback only
 * stands when Reembolso exists. The list can change at runtime, so the keyword
 * map is narrowed on every call.
 * @returns {string} a category present in settings.categories[type]
 */
export function categorizeTransaction(description, type) {
    const allowed = settings.categories[type] ?? [];
    const category = engineCategorize(description, type, restrictKeywords(categoryKeywords, settings.categories));

    return allowed.includes(category) ? category : UNCATEGORIZED;
}

// Populate category dropdowns
export function populateCategoryDropdowns() {
    // Clear category select
    categorySelect.innerHTML = '<option value="all">All Categories</option>';

    // Add expense categories
    const expenseOptgroup = document.createElement('optgroup');
    expenseOptgroup.label = 'Expenses';

    settings.categories.expense.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        expenseOptgroup.appendChild(option);
    });

    categorySelect.appendChild(expenseOptgroup);

    // Add income categories
    const incomeOptgroup = document.createElement('optgroup');
    incomeOptgroup.label = 'Income';

    settings.categories.income.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        incomeOptgroup.appendChild(option);
    });

    categorySelect.appendChild(incomeOptgroup);

    // Rebuilding the options resets the selection; keep the active filter, or drop it if its category is gone.
    const listed = [...settings.categories.expense, ...settings.categories.income].includes(currentFilter.category);
    currentFilter.category = listed ? currentFilter.category : 'all';
    categorySelect.value = currentFilter.category;
}

// Populate transaction category select
export function populateTransactionCategorySelect() {
    // Clear category select
    transactionCategorySelect.innerHTML = '<option value="">-- Select Category --</option>';

    // Get selected type
    const selectedType = document.querySelector('input[name="amount-type"]:checked').value;

    // Add categories based on type
    settings.categories[selectedType].forEach(category => {
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
