import { describe, it, expect, vi } from 'vitest';
import { sortTransactions, renderTransactions, updateSummary, handleDateRangeChange, applyCustomDateFilter, handleSort, updateSortIcons, handleYearFilterChange } from '../js/ui.js';
import { transactions, currentSort, currentFilter, settings } from '../js/state.js';
import {
    transactionsBody, selectAllCheckbox, totalIncomeElement,
    totalExpensesElement, netAmountElement, dateRangeSelect,
    customDateContainer, startDateInput, endDateInput,
    yearFilterContainer, yearFilterSelect
} from '../js/dom.js';

describe('sortTransactions', () => {
    const makeTxn = (overrides) => ({
        date: new Date(2025, 3, 12),
        description: 'Test',
        amount: 50,
        type: 'expense',
        category: 'Casa',
        account: 'Amex',
        ...overrides
    });

    it('sorts by date ascending', () => {
        Object.assign(currentSort, { field: 'date', direction: 'asc' });
        const txns = [
            makeTxn({ date: new Date(2025, 5, 1) }),
            makeTxn({ date: new Date(2025, 0, 1) }),
            makeTxn({ date: new Date(2025, 3, 1) })
        ];
        const sorted = sortTransactions(txns);
        expect(sorted[0].date.getMonth()).toBe(0);
        expect(sorted[1].date.getMonth()).toBe(3);
        expect(sorted[2].date.getMonth()).toBe(5);
    });

    it('sorts by date descending', () => {
        Object.assign(currentSort, { field: 'date', direction: 'desc' });
        const txns = [
            makeTxn({ date: new Date(2025, 0, 1) }),
            makeTxn({ date: new Date(2025, 5, 1) })
        ];
        const sorted = sortTransactions(txns);
        expect(sorted[0].date.getMonth()).toBe(5);
        expect(sorted[1].date.getMonth()).toBe(0);
    });

    it('sorts by amount ascending (expenses negative, income positive)', () => {
        Object.assign(currentSort, { field: 'amount', direction: 'asc' });
        const txns = [
            makeTxn({ amount: 100, type: 'income' }),
            makeTxn({ amount: 200, type: 'expense' }),
            makeTxn({ amount: 50, type: 'expense' })
        ];
        const sorted = sortTransactions(txns);
        // expense -200, expense -50, income +100
        expect(sorted[0].amount).toBe(200);
        expect(sorted[0].type).toBe('expense');
        expect(sorted[2].amount).toBe(100);
        expect(sorted[2].type).toBe('income');
    });

    it('sorts by amount descending', () => {
        Object.assign(currentSort, { field: 'amount', direction: 'desc' });
        const txns = [
            makeTxn({ amount: 200, type: 'expense' }),
            makeTxn({ amount: 100, type: 'income' })
        ];
        const sorted = sortTransactions(txns);
        expect(sorted[0].type).toBe('income');
    });

    it('sorts by category using pt-BR locale', () => {
        Object.assign(currentSort, { field: 'category', direction: 'asc' });
        const txns = [
            makeTxn({ category: 'Viagem' }),
            makeTxn({ category: 'Alimentação' }),
            makeTxn({ category: 'Casa' })
        ];
        const sorted = sortTransactions(txns);
        expect(sorted[0].category).toBe('Alimentação');
        expect(sorted[1].category).toBe('Casa');
        expect(sorted[2].category).toBe('Viagem');
    });

    it('sorts by description (string field)', () => {
        Object.assign(currentSort, { field: 'description', direction: 'asc' });
        const txns = [
            makeTxn({ description: 'Zara' }),
            makeTxn({ description: 'Amazon' }),
            makeTxn({ description: 'Netflix' })
        ];
        const sorted = sortTransactions(txns);
        expect(sorted[0].description).toBe('Amazon');
        expect(sorted[1].description).toBe('Netflix');
        expect(sorted[2].description).toBe('Zara');
    });

    it('handles null/undefined date safely', () => {
        Object.assign(currentSort, { field: 'date', direction: 'asc' });
        const txns = [
            makeTxn({ date: new Date(2025, 3, 1) }),
            makeTxn({ date: undefined })
        ];
        expect(() => sortTransactions(txns)).not.toThrow();
    });

    it('handles null/undefined category safely', () => {
        Object.assign(currentSort, { field: 'category', direction: 'asc' });
        const txns = [
            makeTxn({ category: 'Casa' }),
            makeTxn({ category: undefined })
        ];
        expect(() => sortTransactions(txns)).not.toThrow();
    });

    it('does not mutate original array', () => {
        Object.assign(currentSort, { field: 'date', direction: 'asc' });
        const txns = [
            makeTxn({ date: new Date(2025, 5, 1) }),
            makeTxn({ date: new Date(2025, 0, 1) })
        ];
        const original = [...txns];
        sortTransactions(txns);
        expect(txns[0]).toBe(original[0]);
        expect(txns[1]).toBe(original[1]);
    });
});

describe('renderTransactions', () => {
    const makeTxn = (overrides) => ({
        date: new Date(2025, 3, 12),
        description: 'Test',
        amount: 50,
        type: 'expense',
        category: 'Casa',
        account: 'Amex',
        ...overrides
    });

    it('labels each row control with the transaction it acts on', () => {
        // Arrange
        transactions.push(makeTxn({ description: 'Groceries' }));

        // Act
        renderTransactions();

        // Assert
        const row = document.querySelector('#transactions-body tr');
        expect(row.querySelector('.transaction-checkbox').getAttribute('aria-label')).toBe('Select Groceries');
        expect(row.querySelector('.category-edit-dropdown').getAttribute('aria-label')).toBe('Category for Groceries');
        expect(row.querySelector('.delete-btn').getAttribute('aria-label')).toBe('Delete Groceries');
        expect(document.getElementById('select-all-checkbox').getAttribute('aria-label')).toBe('Select all transactions');
    });

    it('row category dropdown lists the Settings categories for the type', () => {
        // Arrange
        settings.categories.expense = ['Casa', 'Pets', 'Sem Categoria'];
        transactions.push(makeTxn({ category: 'Pets' }));

        // Act
        renderTransactions();

        // Assert
        const select = transactionsBody.querySelector('.category-edit-dropdown');
        expect(Array.from(select.options).map(o => o.value)).toEqual(['Casa', 'Pets', 'Sem Categoria']);
        expect(select.value).toBe('Pets');
    });

    it('keeps a category missing from Settings selectable in its row', () => {
        // Arrange
        settings.categories.expense = ['Sem Categoria'];
        transactions.push(makeTxn({ category: 'Casa' }));

        // Act
        renderTransactions();

        // Assert
        const select = transactionsBody.querySelector('.category-edit-dropdown');
        expect(Array.from(select.options).map(o => o.value)).toEqual(['Sem Categoria', 'Casa']);
        expect(select.value).toBe('Casa');
    });

    it('renders empty table for no transactions', () => {
        renderTransactions();
        expect(transactionsBody.innerHTML.trim()).toBe('');
    });

    it('renders one expense transaction', () => {
        transactions.push(makeTxn());
        renderTransactions();
        const rows = transactionsBody.querySelectorAll('tr');
        expect(rows.length).toBe(1);
    });

    it('displays expense amount with negative sign', () => {
        transactions.push(makeTxn({ amount: 50, type: 'expense' }));
        renderTransactions();
        const amountCell = transactionsBody.querySelector('.negative');
        expect(amountCell).toBeTruthy();
        expect(amountCell.textContent).toContain('-$50.00');
    });

    it('displays income amount with positive sign', () => {
        transactions.push(makeTxn({ amount: 1000, type: 'income' }));
        renderTransactions();
        const amountCell = transactionsBody.querySelector('.positive');
        expect(amountCell).toBeTruthy();
        expect(amountCell.textContent).toContain('$1000.00');
    });

    it('populates category dropdown for each row', () => {
        transactions.push(makeTxn({ type: 'expense', category: 'Casa' }));
        renderTransactions();
        const dropdown = transactionsBody.querySelector('.category-edit-dropdown');
        expect(dropdown).toBeTruthy();
        const options = Array.from(dropdown.options);
        expect(options.some(o => o.value === 'Casa')).toBe(true);
    });

    it('escapes HTML in description to prevent XSS', () => {
        transactions.push(makeTxn({ description: '<img src=x onerror=alert(1)>' }));
        renderTransactions();
        const descCell = transactionsBody.querySelector('.td-longtext');
        expect(descCell.innerHTML).not.toContain('<img');
        expect(descCell.textContent).toBe('<img src=x onerror=alert(1)>');
    });

    it('escapes HTML in account field', () => {
        transactions.push(makeTxn({ account: '<script>alert(1)</script>' }));
        renderTransactions();
        const row = transactionsBody.querySelector('tr');
        const accountCell = row.querySelector('[data-field="account"]');
        expect(accountCell.innerHTML).not.toContain('<script>');
    });

    it('sets correct data-index from original transactions array', () => {
        // Push 3 transactions, filter to only show the 2nd one
        transactions.push(
            makeTxn({ date: new Date(2025, 0, 1), description: 'First' }),
            makeTxn({ date: new Date(2025, 5, 1), description: 'Second' }),
            makeTxn({ date: new Date(2025, 0, 2), description: 'Third' })
        );
        currentFilter.startDate = new Date(2025, 4, 1);
        renderTransactions();
        const rows = transactionsBody.querySelectorAll('tr');
        expect(rows.length).toBe(1);
        // The 2nd transaction (index 1 in original array) should be the only row
        expect(rows[0].getAttribute('data-index')).toBe('1');
    });

    it('resets select-all checkbox', () => {
        selectAllCheckbox.checked = true;
        transactions.push(makeTxn());
        renderTransactions();
        expect(selectAllCheckbox.checked).toBe(false);
    });

    it('renders multiple transactions', () => {
        transactions.push(makeTxn(), makeTxn({ description: 'Second' }));
        renderTransactions();
        const rows = transactionsBody.querySelectorAll('tr');
        expect(rows.length).toBe(2);
    });
});

describe('updateSummary', () => {
    it('shows zeroes for no transactions', () => {
        updateSummary();
        expect(totalIncomeElement.textContent).toBe('$0.00');
        expect(totalExpensesElement.textContent).toBe('$0.00');
        expect(netAmountElement.textContent).toBe('$0.00');
    });

    it('calculates income only', () => {
        transactions.push({ date: new Date(), description: 'Salary', amount: 1000, type: 'income', category: 'Trabalho', account: 'TD' });
        updateSummary();
        expect(totalIncomeElement.textContent).toBe('$1000.00');
        expect(totalExpensesElement.textContent).toBe('$0.00');
        expect(netAmountElement.textContent).toBe('$1000.00');
        expect(netAmountElement.className).toBe('positive');
    });

    it('calculates expense only', () => {
        transactions.push({ date: new Date(), description: 'Groceries', amount: 500, type: 'expense', category: 'Mercado', account: 'Amex' });
        updateSummary();
        expect(totalIncomeElement.textContent).toBe('$0.00');
        expect(totalExpensesElement.textContent).toBe('$500.00');
        expect(netAmountElement.textContent).toBe('$-500.00');
        expect(netAmountElement.className).toBe('negative');
    });

    it('calculates mixed income and expenses', () => {
        transactions.push(
            { date: new Date(), description: 'Salary', amount: 1000, type: 'income', category: 'Trabalho', account: 'TD' },
            { date: new Date(), description: 'Groceries', amount: 300, type: 'expense', category: 'Mercado', account: 'Amex' }
        );
        updateSummary();
        expect(totalIncomeElement.textContent).toBe('$1000.00');
        expect(totalExpensesElement.textContent).toBe('$300.00');
        expect(netAmountElement.textContent).toBe('$700.00');
        expect(netAmountElement.className).toBe('positive');
    });
});

describe('handleDateRangeChange', () => {
    it('shows custom date container when custom selected', () => {
        dateRangeSelect.value = 'custom';
        handleDateRangeChange();
        expect(customDateContainer.style.display).toBe('flex');
    });

    it('sets current-month date range', () => {
        dateRangeSelect.value = 'current-month';
        handleDateRangeChange();
        const today = new Date();
        expect(currentFilter.startDate.getMonth()).toBe(today.getMonth());
        expect(currentFilter.startDate.getDate()).toBe(1);
    });

    it('sets last-month date range', () => {
        dateRangeSelect.value = 'last-month';
        handleDateRangeChange();
        const today = new Date();
        const lastMonth = today.getMonth() - 1;
        const expectedMonth = lastMonth < 0 ? 11 : lastMonth;
        expect(currentFilter.startDate.getMonth()).toBe(expectedMonth);
    });

    it('sets two-months-ago date range (single month, 2 months ago)', () => {
        dateRangeSelect.value = 'two-months-ago';
        handleDateRangeChange();
        const today = new Date();
        // Start: 1st of 2 months ago
        const expectedStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        expect(currentFilter.startDate.getFullYear()).toBe(expectedStart.getFullYear());
        expect(currentFilter.startDate.getMonth()).toBe(expectedStart.getMonth());
        expect(currentFilter.startDate.getDate()).toBe(1);
        // End: last day of that same month (2 months ago)
        const expectedEnd = new Date(today.getFullYear(), today.getMonth() - 1, 0);
        expect(currentFilter.endDate.getFullYear()).toBe(expectedEnd.getFullYear());
        expect(currentFilter.endDate.getMonth()).toBe(expectedEnd.getMonth());
        expect(currentFilter.endDate.getDate()).toBe(expectedEnd.getDate());
    });

    it('sets two-months-ago across year boundary', () => {
        // When currentMonth=0 (Jan), 2 months ago = Nov of previous year
        // new Date(year, 0-2, 1) = new Date(year, -2, 1) = Nov 1 prev year
        // new Date(year, 0-1, 0) = new Date(year, -1, 0) = Nov 30 prev year
        const today = new Date();
        const expectedStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        const expectedEnd = new Date(today.getFullYear(), today.getMonth() - 1, 0);
        dateRangeSelect.value = 'two-months-ago';
        handleDateRangeChange();
        expect(currentFilter.startDate.getFullYear()).toBe(expectedStart.getFullYear());
        expect(currentFilter.startDate.getMonth()).toBe(expectedStart.getMonth());
        expect(currentFilter.endDate.getFullYear()).toBe(expectedEnd.getFullYear());
        expect(currentFilter.endDate.getMonth()).toBe(expectedEnd.getMonth());
    });

    it('sets current-year date range', () => {
        dateRangeSelect.value = 'current-year';
        handleDateRangeChange();
        const year = new Date().getFullYear();
        expect(currentFilter.startDate.getFullYear()).toBe(year);
        expect(currentFilter.startDate.getMonth()).toBe(0);
        expect(currentFilter.startDate.getDate()).toBe(1);
        expect(currentFilter.endDate.getMonth()).toBe(11);
        expect(currentFilter.endDate.getDate()).toBe(31);
    });

    it('sets last-year date range', () => {
        dateRangeSelect.value = 'last-year';
        handleDateRangeChange();
        const lastYear = new Date().getFullYear() - 1;
        expect(currentFilter.startDate.getFullYear()).toBe(lastYear);
        expect(currentFilter.startDate.getMonth()).toBe(0);
        expect(currentFilter.startDate.getDate()).toBe(1);
        expect(currentFilter.endDate.getFullYear()).toBe(lastYear);
        expect(currentFilter.endDate.getMonth()).toBe(11);
        expect(currentFilter.endDate.getDate()).toBe(31);
    });

    it('clears dates for "all"', () => {
        dateRangeSelect.value = 'all';
        handleDateRangeChange();
        expect(currentFilter.startDate).toBeNull();
        expect(currentFilter.endDate).toBeNull();
    });

    it('hides custom container for non-custom selections', () => {
        dateRangeSelect.value = 'all';
        handleDateRangeChange();
        expect(customDateContainer.style.display).toBe('none');
    });
});

describe('year filter', () => {
    const makeTxn = (date, description = 'Test') => ({
        date, description, amount: 50, type: 'expense', category: 'Casa', account: 'Amex'
    });
    const optionValues = () => [...yearFilterSelect.options].map(option => option.value);
    const shownDescriptions = () => [...transactionsBody.querySelectorAll('tr')].map(row => row.querySelector('td[data-field="description"]').textContent);
    const chooseYearRange = () => {
        dateRangeSelect.value = 'year';
        handleDateRangeChange();
    };

    it('shows a year selector listing each year with transactions once, newest first', () => {
        // Arrange
        transactions.push(makeTxn(new Date(2016, 8, 3)), makeTxn(new Date(2024, 0, 1)), makeTxn(new Date(2024, 11, 31)), makeTxn(new Date(2019, 5, 1)));

        // Act
        chooseYearRange();

        // Assert
        expect(yearFilterContainer.style.display).toBe('flex');
        expect(optionValues()).toEqual(['2024', '2019', '2016']);
    });

    it('filters to the newest year at first', () => {
        // Arrange
        transactions.push(makeTxn(new Date(2019, 5, 1)), makeTxn(new Date(2024, 5, 1)));

        // Act
        chooseYearRange();

        // Assert
        expect(yearFilterSelect.value).toBe('2024');
        expect(currentFilter.dateRange).toBe('year');
        expect(currentFilter.startDate).toEqual(new Date(2024, 0, 1));
        expect(currentFilter.endDate).toEqual(new Date(2024, 11, 31));
    });

    it('shows only the chosen year, its first and last days included', () => {
        // Arrange
        transactions.push(
            makeTxn(new Date(2018, 11, 31, 23, 0), 'Dec 31 before'),
            makeTxn(new Date(2019, 0, 1), 'Jan 1'),
            makeTxn(new Date(2019, 11, 31, 23, 0), 'Dec 31'),
            makeTxn(new Date(2020, 0, 1), 'Jan 1 after')
        );
        chooseYearRange();
        yearFilterSelect.value = '2019';

        // Act
        handleYearFilterChange();

        // Assert
        expect(shownDescriptions()).toEqual(['Jan 1', 'Dec 31']);
    });

    it('offers the current year when there are no transactions', () => {
        // Arrange
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 5, 1));

        // Act
        chooseYearRange();
        vi.useRealTimers();

        // Assert
        expect(optionValues()).toEqual(['2026']);
        expect(currentFilter.startDate).toEqual(new Date(2026, 0, 1));
    });

    it('keeps the chosen year when Select Year is picked again', () => {
        // Arrange
        transactions.push(makeTxn(new Date(2019, 5, 1)), makeTxn(new Date(2024, 5, 1)));
        chooseYearRange();
        yearFilterSelect.value = '2019';
        handleYearFilterChange();
        dateRangeSelect.value = 'all';
        handleDateRangeChange();

        // Act
        chooseYearRange();

        // Assert
        expect(yearFilterSelect.value).toBe('2019');
        expect(currentFilter.startDate).toEqual(new Date(2019, 0, 1));
    });

    it('falls back to the newest year when Select Year is picked again after the chosen year lost its transactions', () => {
        // Arrange
        transactions.push(makeTxn(new Date(2019, 5, 1)), makeTxn(new Date(2024, 5, 1)));
        chooseYearRange();
        yearFilterSelect.value = '2019';
        handleYearFilterChange();
        dateRangeSelect.value = 'all';
        handleDateRangeChange();
        transactions.splice(0, 1);

        // Act
        chooseYearRange();

        // Assert
        expect(optionValues()).toEqual(['2024']);
        expect(currentFilter.startDate).toEqual(new Date(2024, 0, 1));
    });

    it('adds a newly imported year on redraw and keeps the chosen one, even once it has no transactions', () => {
        // Arrange
        transactions.push(makeTxn(new Date(2019, 5, 1)));
        chooseYearRange();
        transactions.length = 0;
        transactions.push(makeTxn(new Date(2025, 5, 1)));

        // Act
        renderTransactions();

        // Assert
        expect(optionValues()).toEqual(['2025', '2019']);
        expect(yearFilterSelect.value).toBe('2019');
    });

    it.each(['all', 'current-year', 'custom'])('hides the year selector for %s', range => {
        // Arrange
        chooseYearRange();
        dateRangeSelect.value = range;

        // Act
        handleDateRangeChange();

        // Assert
        expect(yearFilterContainer.style.display).toBe('none');
    });

    it('hides the custom range inputs when Select Year is picked after Custom Range', () => {
        // Arrange
        dateRangeSelect.value = 'custom';
        handleDateRangeChange();

        // Act
        chooseYearRange();

        // Assert
        expect(customDateContainer.style.display).toBe('none');
    });
});

describe('applyCustomDateFilter', () => {
    it('sets custom date filter with valid range', () => {
        startDateInput.value = '2025-01-01';
        endDateInput.value = '2025-06-30';
        applyCustomDateFilter();
        expect(currentFilter.dateRange).toBe('custom');
        expect(currentFilter.startDate).toBeTruthy();
        expect(currentFilter.endDate).toBeTruthy();
    });

    it('alerts when start date is after end date', () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        startDateInput.value = '2025-06-30';
        endDateInput.value = '2025-01-01';
        applyCustomDateFilter();
        expect(alertSpy).toHaveBeenCalledWith('Start date cannot be after end date.');
        alertSpy.mockRestore();
    });

    it('handles empty start date', () => {
        startDateInput.value = '';
        endDateInput.value = '2025-06-30';
        applyCustomDateFilter();
        expect(currentFilter.startDate).toBeNull();
        expect(currentFilter.endDate).toBeTruthy();
    });

    it('handles empty end date', () => {
        startDateInput.value = '2025-01-01';
        endDateInput.value = '';
        applyCustomDateFilter();
        expect(currentFilter.startDate).toBeTruthy();
        expect(currentFilter.endDate).toBeNull();
    });
});

describe('handleSort', () => {
    it('sets ascending sort on first click', () => {
        Object.assign(currentSort, { field: 'date', direction: 'desc' });
        handleSort('amount');
        expect(currentSort.field).toBe('amount');
        expect(currentSort.direction).toBe('asc');
    });

    it('toggles direction on same field click', () => {
        Object.assign(currentSort, { field: 'amount', direction: 'asc' });
        handleSort('amount');
        expect(currentSort.direction).toBe('desc');
    });

    it('toggles back to asc on third click', () => {
        Object.assign(currentSort, { field: 'amount', direction: 'desc' });
        handleSort('amount');
        expect(currentSort.direction).toBe('asc');
    });
});

describe('updateSortIcons', () => {
    it('shows ascending icon for current sort field', () => {
        Object.assign(currentSort, { field: 'date', direction: 'asc' });
        updateSortIcons();
        const dateTh = document.querySelector('th[data-sort="date"] .sort-icon');
        expect(dateTh.textContent).toBe('▲');
    });

    it('shows descending icon for current sort field', () => {
        Object.assign(currentSort, { field: 'date', direction: 'desc' });
        updateSortIcons();
        const dateTh = document.querySelector('th[data-sort="date"] .sort-icon');
        expect(dateTh.textContent).toBe('▼');
    });

    it('clears other field icons', () => {
        Object.assign(currentSort, { field: 'date', direction: 'asc' });
        updateSortIcons();
        const amountIcon = document.querySelector('th[data-sort="amount"] .sort-icon');
        expect(amountIcon.textContent).toBe('');
    });

    it.each([['asc', 'ascending'], ['desc', 'descending']])('marks the sorted column as %s for screen readers', (direction, ariaSort) => {
        // Arrange
        Object.assign(currentSort, { field: 'amount', direction });

        // Act
        updateSortIcons();

        // Assert
        expect(document.querySelector('th[data-sort="amount"]').getAttribute('aria-sort')).toBe(ariaSort);
        expect(document.querySelector('th[data-sort="date"]').hasAttribute('aria-sort')).toBe(false);
    });
});
