import { transactionDateInput } from './dom.js';
import { dateInputValue } from './utils.js';
import { loadData } from './storage.js';
import { populateCategoryDropdowns } from './categories.js';
import { handleDateRangeChange, updateSortIcons, renderTransactions, updateSummary } from './ui.js';
import { addEventListeners } from './events.js';
import { initTabs } from './tabs.js';
import { initBalanceSheet, renderBalanceSheet } from './balance-sheet-ui.js';
import { initSettings, renderSettings } from './settings-ui.js';
import { initFire, renderFire } from './fire-ui.js';
import { initTips } from './explanations.js';

// The Balance Sheet, Investments & FIRE and Settings re-render whenever their tab is opened.
// Settings changes the Transactions tab shows (categories, restore) only mark it out of date: they
// happen while it is hidden, and redrawing its table is the costliest thing the app does, so it waits
// until the tab is opened. Other Settings changes leave it alone.
let transactionsStale = false;

function refreshTransactionsView() {
    populateCategoryDropdowns();
    renderTransactions();
    updateSummary();
    transactionsStale = false;
}

const TAB_RENDERERS = {
    'tab-transactions': () => {
        if (transactionsStale) {
            refreshTransactionsView();
        }
    },
    'tab-balance-sheet': renderBalanceSheet,
    'tab-fire': renderFire,
    'tab-settings': renderSettings
};

// Initialize the application
export function init() {
    // Set today's date as default for the transaction form
    const today = dateInputValue(new Date());
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
    initBalanceSheet();
    initFire();
    initTips();
    transactionsStale = false;
    initSettings({ onTransactionsViewChanged: () => { transactionsStale = true; } });
    initTabs({ onActivate: tabId => TAB_RENDERERS[tabId]() });
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
