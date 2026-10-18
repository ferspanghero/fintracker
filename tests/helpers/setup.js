import { beforeEach } from 'vitest';
import { HTML_FIXTURE } from './dom-fixture.js';
import { refreshDom } from '../../js/dom.js';
import { currentSort, currentFilter, replaceAll } from '../../js/state.js';
import { emptySettings } from '../../js/settings.js';
import { SAMPLE_CATEGORIES } from '../fixtures/sample-categories.js';

// Inject DOM fixture before modules that reference DOM elements are evaluated
document.body.innerHTML = HTML_FIXTURE;
refreshDom();

// Reset mutable global state before each test
beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = HTML_FIXTURE;
    refreshDom();

    // Reset data state; tests start with the full sample category list so the
    // categorizer can reach every keyword route.
    replaceAll({
        transactions: [],
        settings: { ...emptySettings(), categories: structuredClone(SAMPLE_CATEGORIES) },
        balances: {},
        closedMonths: [],
        registeredRoom: []
    });
    Object.assign(currentSort, { field: 'date', direction: 'asc' });
    Object.assign(currentFilter, { dateRange: 'all', startDate: null, endDate: null, category: 'all', textFilter: '' });

    // Clear localStorage
    localStorage.clear();
});
