import { describe, it, expect, vi } from 'vitest';

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
        currentSort = { field: 'date', direction: 'asc' };
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
        currentSort = { field: 'date', direction: 'desc' };
        const txns = [
            makeTxn({ date: new Date(2025, 0, 1) }),
            makeTxn({ date: new Date(2025, 5, 1) })
        ];
        const sorted = sortTransactions(txns);
        expect(sorted[0].date.getMonth()).toBe(5);
        expect(sorted[1].date.getMonth()).toBe(0);
    });

    it('sorts by amount ascending (expenses negative, income positive)', () => {
        currentSort = { field: 'amount', direction: 'asc' };
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
        currentSort = { field: 'amount', direction: 'desc' };
        const txns = [
            makeTxn({ amount: 200, type: 'expense' }),
            makeTxn({ amount: 100, type: 'income' })
        ];
        const sorted = sortTransactions(txns);
        expect(sorted[0].type).toBe('income');
    });

    it('sorts by category using pt-BR locale', () => {
        currentSort = { field: 'category', direction: 'asc' };
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
        currentSort = { field: 'description', direction: 'asc' };
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
        currentSort = { field: 'date', direction: 'asc' };
        const txns = [
            makeTxn({ date: new Date(2025, 3, 1) }),
            makeTxn({ date: undefined })
        ];
        expect(() => sortTransactions(txns)).not.toThrow();
    });

    it('handles null/undefined category safely', () => {
        currentSort = { field: 'category', direction: 'asc' };
        const txns = [
            makeTxn({ category: 'Casa' }),
            makeTxn({ category: undefined })
        ];
        expect(() => sortTransactions(txns)).not.toThrow();
    });

    it('does not mutate original array', () => {
        currentSort = { field: 'date', direction: 'asc' };
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

    it('renders empty table for no transactions', () => {
        transactions = [];
        renderTransactions();
        expect(transactionsBody.innerHTML.trim()).toBe('');
    });

    it('renders one expense transaction', () => {
        transactions = [makeTxn()];
        renderTransactions();
        const rows = transactionsBody.querySelectorAll('tr');
        expect(rows.length).toBe(1);
    });

    it('displays expense amount with negative sign', () => {
        transactions = [makeTxn({ amount: 50, type: 'expense' })];
        renderTransactions();
        const amountCell = transactionsBody.querySelector('.negative');
        expect(amountCell).toBeTruthy();
        expect(amountCell.textContent).toContain('-$50.00');
    });

    it('displays income amount with positive sign', () => {
        transactions = [makeTxn({ amount: 1000, type: 'income' })];
        renderTransactions();
        const amountCell = transactionsBody.querySelector('.positive');
        expect(amountCell).toBeTruthy();
        expect(amountCell.textContent).toContain('$1000.00');
    });

    it('populates category dropdown for each row', () => {
        transactions = [makeTxn({ type: 'expense', category: 'Casa' })];
        renderTransactions();
        const dropdown = transactionsBody.querySelector('.category-edit-dropdown');
        expect(dropdown).toBeTruthy();
        const options = Array.from(dropdown.options);
        expect(options.some(o => o.value === 'Casa')).toBe(true);
    });

    it('resets select-all checkbox', () => {
        selectAllCheckbox.checked = true;
        transactions = [makeTxn()];
        renderTransactions();
        expect(selectAllCheckbox.checked).toBe(false);
    });

    it('renders multiple transactions', () => {
        transactions = [makeTxn(), makeTxn({ description: 'Second' })];
        renderTransactions();
        const rows = transactionsBody.querySelectorAll('tr');
        expect(rows.length).toBe(2);
    });
});

describe('updateSummary', () => {
    it('shows zeroes for no transactions', () => {
        transactions = [];
        updateSummary();
        expect(totalIncomeElement.textContent).toBe('$0.00');
        expect(totalExpensesElement.textContent).toBe('$0.00');
        expect(netAmountElement.textContent).toBe('$0.00');
    });

    it('calculates income only', () => {
        transactions = [{ date: new Date(), description: 'Salary', amount: 1000, type: 'income', category: 'Trabalho', account: 'TD' }];
        updateSummary();
        expect(totalIncomeElement.textContent).toBe('$1000.00');
        expect(totalExpensesElement.textContent).toBe('$0.00');
        expect(netAmountElement.textContent).toBe('$1000.00');
        expect(netAmountElement.className).toBe('positive');
    });

    it('calculates expense only', () => {
        transactions = [{ date: new Date(), description: 'Groceries', amount: 500, type: 'expense', category: 'Mercado', account: 'Amex' }];
        updateSummary();
        expect(totalIncomeElement.textContent).toBe('$0.00');
        expect(totalExpensesElement.textContent).toBe('$500.00');
        expect(netAmountElement.textContent).toBe('$-500.00');
        expect(netAmountElement.className).toBe('negative');
    });

    it('calculates mixed income and expenses', () => {
        transactions = [
            { date: new Date(), description: 'Salary', amount: 1000, type: 'income', category: 'Trabalho', account: 'TD' },
            { date: new Date(), description: 'Groceries', amount: 300, type: 'expense', category: 'Mercado', account: 'Amex' }
        ];
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
        currentSort = { field: 'date', direction: 'desc' };
        handleSort('amount');
        expect(currentSort.field).toBe('amount');
        expect(currentSort.direction).toBe('asc');
    });

    it('toggles direction on same field click', () => {
        currentSort = { field: 'amount', direction: 'asc' };
        handleSort('amount');
        expect(currentSort.direction).toBe('desc');
    });

    it('toggles back to asc on third click', () => {
        currentSort = { field: 'amount', direction: 'desc' };
        handleSort('amount');
        expect(currentSort.direction).toBe('asc');
    });
});

describe('updateSortIcons', () => {
    it('shows ascending icon for current sort field', () => {
        currentSort = { field: 'date', direction: 'asc' };
        updateSortIcons();
        const dateTh = document.querySelector('th[data-sort="date"] .sort-icon');
        expect(dateTh.textContent).toBe('▲');
    });

    it('shows descending icon for current sort field', () => {
        currentSort = { field: 'date', direction: 'desc' };
        updateSortIcons();
        const dateTh = document.querySelector('th[data-sort="date"] .sort-icon');
        expect(dateTh.textContent).toBe('▼');
    });

    it('clears other field icons', () => {
        currentSort = { field: 'date', direction: 'asc' };
        updateSortIcons();
        const amountIcon = document.querySelector('th[data-sort="amount"] .sort-icon');
        expect(amountIcon.textContent).toBe('');
    });
});
