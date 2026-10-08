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

// Why this branch instead of a plain `addEventListener('DOMContentLoaded', init)`:
// `categories.js` and `import-export.js` use top-level `await` to load optional
// personal keywords and ignore prefixes.
// That pauses the evaluation of every module that imports it (including this
// one), and the browser's DOMContentLoaded event can fire BEFORE the await
// resolves and this line runs. If we only registered a listener, it would
// attach after the event already fired and `init()` would never be called —
// the page would render but no handlers would be wired up. Checking
// `readyState` lets us register-or-run, covering both timings.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
