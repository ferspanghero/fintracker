import { transactions, currentSort, currentFilter, settings } from './state.js';
import {
    transactionsBody, selectAllCheckbox, totalIncomeElement,
    totalExpensesElement, netAmountElement, dateRangeSelect,
    customDateContainer, startDateInput, endDateInput,
    yearFilterContainer, yearFilterSelect
} from './dom.js';
import { dateStrInputToLocalDate, escapeHTML } from './utils.js';
import { getFilteredTransactions, updateTransactionField, deleteTransaction } from './transactions.js';
import { UNCATEGORIZED } from './category-engine.js';
import { INCOME, EXPENSE } from './constants.js';

// Render transactions
export function renderTransactions() {
    // An import or restore can bring a new year to choose from
    if (currentFilter.dateRange === 'year') {
        populateYearFilter({ keepEmptyChosen: true });
    }

    // Clear table
    transactionsBody.innerHTML = '';

    // Get filtered transactions
    const filteredTransactions = getFilteredTransactions();

    // Sort transactions
    const sortedTransactions = sortTransactions(filteredTransactions);

    // Build index map for O(1) lookups instead of O(n) indexOf
    const indexMap = new Map(transactions.map((t, i) => [t, i]));

    // Render each transaction
    sortedTransactions.forEach((transaction, index) => {
        const row = document.createElement('tr');
        row.setAttribute('data-index', indexMap.get(transaction));

        // Format date
        const dateFormatted = transaction.date.toLocaleDateString();

        // Format amount
        const amountFormatted = transaction.amount.toFixed(2);
        const amountClass = transaction.type === INCOME ? 'positive' : 'negative';
        const amountDisplay = transaction.type === INCOME ? `$${amountFormatted}` : `-$${amountFormatted}`;

        // A category missing from Settings (e.g. data restored before its category
        // was added) stays visible instead of silently showing another option.
        const currentCategory = transaction.category || UNCATEGORIZED;
        const categoryOptions = settings.categories[transaction.type].includes(currentCategory)
            ? settings.categories[transaction.type]
            : [...settings.categories[transaction.type], currentCategory];

        const description = escapeHTML(transaction.description);

        // Create cells
        row.innerHTML = `
            <td>
                <input type="checkbox" class="transaction-checkbox" aria-label="Select ${description}">
            </td>
            <td class="editable" data-field="date">${escapeHTML(dateFormatted)}</td>
            <td class="editable td-longtext" data-field="description">${escapeHTML(transaction.description)}</td>
            <td class="editable ${amountClass}" data-field="amount">${escapeHTML(amountDisplay)}</td>
            <td class="editable" data-field="category">
                <select class="category-edit-dropdown" aria-label="Category for ${description}">
                    ${categoryOptions.map(category =>
                        `<option value="${escapeHTML(category)}" ${category === currentCategory ? 'selected' : ''}>${escapeHTML(category)}</option>`
                    ).join('')}
                </select>
            </td>
            <td class="editable" data-field="account">${escapeHTML(transaction.account)}</td>
            <td class="editable" data-field="type">${escapeHTML(transaction.type)}</td>
            <td>
                <div class="action-buttons">
                    <button class="delete-btn" aria-label="Delete ${description}">Delete</button>
                </div>
            </td>
        `;

        row.querySelector('.category-edit-dropdown').addEventListener('change', (e) => {
            updateTransactionField(indexMap.get(transaction), "category", e.target.value);
        });

        row.querySelector('.delete-btn').addEventListener('click', () => {
            deleteTransaction(indexMap.get(transaction));
        });

        // Add row to table
        transactionsBody.appendChild(row);
    });

    // Reset select all checkbox
    selectAllCheckbox.checked = false;
}

// Sort transactions
export function sortTransactions(transactionsToSort) {
    return [...transactionsToSort].sort((a, b) => {
        // Get values safely with defaults for each field
        const field = currentSort.field;
        const isAsc = currentSort.direction === 'asc';

        // Handle different field types
        if (field === 'date') {
            const dateA = a.date?.getTime() || 0;
            const dateB = b.date?.getTime() || 0;
            return isAsc ? dateA - dateB : dateB - dateA;
        }

        if (field === 'amount') {
            // Some amounts may be absolute, so need to treat them all equally
            const amountA = (Math.abs(a.amount) ?? 0) * (a.type === EXPENSE ? -1 : 1);
            const amountB = (Math.abs(b.amount) ?? 0) * (b.type === EXPENSE ? -1 : 1);

            return isAsc ? amountA - amountB : amountB - amountA;
        }

        if (field === 'category') {
            const categoryA = a.category || '';
            const categoryB = b.category || '';
            return isAsc
                ? categoryA.localeCompare(categoryB, 'pt-BR')
                : categoryB.localeCompare(categoryA, 'pt-BR');
        }

        // Default case for any other string fields
        const strA = typeof a[field] === 'string' ? a[field] : '';
        const strB = typeof b[field] === 'string' ? b[field] : '';
        return isAsc
            ? strA.localeCompare(strB, 'en-US')
            : strB.localeCompare(strA, 'en-US');
    });
}

// Update summary
export function updateSummary() {
    // Get filtered transactions
    const filteredTransactions = getFilteredTransactions();

    // Calculate totals
    let totalIncome = 0;
    let totalExpenses = 0;

    filteredTransactions.forEach(transaction => {
        if (transaction.type === INCOME) {
            totalIncome += transaction.amount;
        } else {
            totalExpenses += transaction.amount;
        }
    });

    const netAmount = totalIncome - totalExpenses;

    // Update summary elements
    totalIncomeElement.textContent = `$${totalIncome.toFixed(2)}`;
    totalExpensesElement.textContent = `$${totalExpenses.toFixed(2)}`;
    netAmountElement.textContent = `$${netAmount.toFixed(2)}`;

    // Set net amount color
    netAmountElement.className = netAmount >= 0 ? 'positive' : 'negative';
}

// Handle date range change
export function handleDateRangeChange() {
    const selectedRange = dateRangeSelect.value;

    // Show/hide custom date range inputs and the year selector
    customDateContainer.style.display = selectedRange === 'custom' ? 'flex' : 'none';
    yearFilterContainer.style.display = selectedRange === 'year' ? 'flex' : 'none';

    if (selectedRange !== 'custom') {
        // Apply the selected date range
        currentFilter.dateRange = selectedRange;
        currentFilter.startDate = null;
        currentFilter.endDate = null;

        // Set date range based on selection
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();

        switch (selectedRange) {
            case 'current-month':
                currentFilter.startDate = new Date(currentYear, currentMonth, 1);
                currentFilter.endDate = new Date(currentYear, currentMonth + 1, 0);
                break;
            case 'last-month':
                currentFilter.startDate = new Date(currentYear, currentMonth - 1, 1);
                currentFilter.endDate = new Date(currentYear, currentMonth, 0);
                break;
            case 'two-months-ago':
                currentFilter.startDate = new Date(currentYear, currentMonth - 2, 1);
                currentFilter.endDate = new Date(currentYear, currentMonth - 1, 0);
                break;
            case 'current-year':
                currentFilter.startDate = new Date(currentYear, 0, 1);
                currentFilter.endDate = new Date(currentYear, 11, 31);
                break;
            case 'last-year':
                currentFilter.startDate = new Date(currentYear - 1, 0, 1);
                currentFilter.endDate = new Date(currentYear - 1, 11, 31);
                break;
            case 'year':
                populateYearFilter({ keepEmptyChosen: false });
                setYearRange();
                break;
            case 'all':
                // No date filters
                break;
        }

        // Apply filters and update view
        renderTransactions();
        updateSummary();
    }
}

// Years with transactions, newest first; none at all offers this year. On redraws the chosen year
// stays listed and chosen even once it has none, so the filter never switches on its own; picking
// Select Year again falls back to the newest year instead.
function populateYearFilter({ keepEmptyChosen }) {
    const chosen = Number(yearFilterSelect.value);
    const withTransactions = new Set(transactions.map(transaction => transaction.date.getFullYear()));
    const keepChosen = Boolean(chosen) && (keepEmptyChosen || withTransactions.has(chosen));
    const years = new Set(withTransactions);

    if (keepChosen) {
        years.add(chosen);
    }

    if (!years.size) {
        years.add(new Date().getFullYear());
    }

    const sorted = [...years].sort((a, b) => b - a);

    // Rewritten only when the list changes, so a focused selector isn't re-announced on every redraw
    if ([...yearFilterSelect.options].map(option => option.value).join() !== sorted.join()) {
        yearFilterSelect.innerHTML = sorted.map(year => `<option value="${year}">${year}</option>`).join('');
    }

    yearFilterSelect.value = String(keepChosen ? chosen : sorted[0]);
}

function setYearRange() {
    const year = Number(yearFilterSelect.value);

    currentFilter.startDate = new Date(year, 0, 1);
    currentFilter.endDate = new Date(year, 11, 31);
}

// Apply the year chosen in the year selector
export function handleYearFilterChange() {
    setYearRange();
    renderTransactions();
    updateSummary();
}

// Apply custom date filter
export function applyCustomDateFilter() {
    const startDate = startDateInput.value ? dateStrInputToLocalDate(startDateInput.value) : null;
    const endDate = endDateInput.value ? dateStrInputToLocalDate(endDateInput.value) : null;

    if (startDate && endDate && startDate > endDate) {
        alert('Start date cannot be after end date.');
        return;
    }

    currentFilter.dateRange = 'custom';
    currentFilter.startDate = startDate;
    currentFilter.endDate = endDate;

    // Apply filters and update view
    renderTransactions();
    updateSummary();
}

// Handle sort
export function handleSort(field) {
    // Toggle sort direction if same field is clicked
    if (currentSort.field === field) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.field = field;
        currentSort.direction = 'asc';
    }

    // Update sort icons
    updateSortIcons();

    // Re-render transactions with new sort
    renderTransactions();
}

// Update sort icons
export function updateSortIcons() {
    // Clear all sort icons and states
    document.querySelectorAll('th.sortable').forEach(th => {
        th.querySelector('.sort-icon').textContent = '';
        th.removeAttribute('aria-sort');
    });

    // Set the icon for the current sort field
    const th = document.querySelector(`th[data-sort="${currentSort.field}"]`);
    if (th) {
        const ascending = currentSort.direction === 'asc';
        th.querySelector('.sort-icon').textContent = ascending ? '▲' : '▼';
        th.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
    }
}
