import { beforeEach } from 'vitest';
import { HTML_FIXTURE } from './dom-fixture.js';
import { refreshDom } from '../../js/dom.js';
import { transactions, currentSort, currentFilter } from '../../js/state.js';
import { categories, defaultCategories } from '../../js/categories.js';

// Inject DOM fixture before modules that reference DOM elements are evaluated
document.body.innerHTML = HTML_FIXTURE;
refreshDom();

// Store default categories for reset
const _defaultCategoriesSnapshot = JSON.parse(JSON.stringify(defaultCategories));

// Reset mutable global state before each test
beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = HTML_FIXTURE;
    refreshDom();

    // Reset data state
    transactions.length = 0;
    Object.assign(currentSort, { field: 'date', direction: 'asc' });
    Object.assign(currentFilter, { dateRange: 'all', startDate: null, endDate: null, category: 'all', textFilter: '' });

    const fresh = JSON.parse(JSON.stringify(_defaultCategoriesSnapshot));
    Object.assign(categories, fresh);

    // Clear localStorage
    localStorage.clear();
});
