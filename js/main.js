import { transactionDateInput } from './dom.js';
import { loadData } from './storage.js';
import { populateCategoryDropdowns } from './categories.js';
import { handleDateRangeChange, updateSortIcons } from './ui.js';
import { addEventListeners } from './events.js';

// Initialize the application
export function init() {
    // Set today's date as default for the transaction form
    const today = new Date().toISOString().split('T')[0];
    transactionDateInput.value = today;

    // Load data from local storage
    loadData();

    // Populate category dropdowns
    populateCategoryDropdowns();

    // Apply the browser-restored date range and render
    handleDateRangeChange();

    // Set initial sort icon to match default sort state
    updateSortIcons();

    // Add event listeners
    addEventListeners();
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', init);
