import { describe, it, expect, vi } from 'vitest';
import { addEventListeners } from '../js/events.js';
import { transactions, currentFilter, currentSort } from '../js/state.js';
import { renderTransactions } from '../js/ui.js';
import {
    importBtn, dateRangeSelect, applyDateFilterBtn, categorySelect,
    textFilterInput, addTransactionBtn, exportCsvBtn, clearAllBtn,
    deleteSelectedBtn, selectAllCheckbox, transactionForm,
    transactionCategorySelect, addTransactionModal, startDateInput, endDateInput,
    customDateContainer, yearFilterSelect
} from '../js/dom.js';

describe('addEventListeners', () => {
    it('wires import button to handleImport', () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        addEventListeners();
        importBtn.click();
        // handleImport alerts when no files selected
        expect(alertSpy).toHaveBeenCalledWith('Please select at least one file to import.');
        alertSpy.mockRestore();
    });

    it('wires date range select to handleDateRangeChange', () => {
        addEventListeners();
        dateRangeSelect.value = 'current-year';
        dateRangeSelect.dispatchEvent(new Event('change'));
        expect(currentFilter.startDate).toBeTruthy();
        expect(currentFilter.startDate.getMonth()).toBe(0);
    });

    it('wires the year select to filter by the chosen year', () => {
        // Arrange
        const makeTxn = date => ({ date, description: 'Test', amount: 1, type: 'expense', category: 'Casa', account: 'Amex' });
        transactions.push(makeTxn(new Date(2019, 5, 1)), makeTxn(new Date(2024, 5, 1)));
        addEventListeners();
        dateRangeSelect.value = 'year';
        dateRangeSelect.dispatchEvent(new Event('change'));
        yearFilterSelect.value = '2019';

        // Act
        yearFilterSelect.dispatchEvent(new Event('change'));

        // Assert
        expect(currentFilter.startDate).toEqual(new Date(2019, 0, 1));
        expect(currentFilter.endDate).toEqual(new Date(2019, 11, 31));
    });

    it('wires apply date filter button', () => {
        addEventListeners();
        startDateInput.value = '2025-01-01';
        endDateInput.value = '2025-06-30';
        applyDateFilterBtn.click();
        expect(currentFilter.dateRange).toBe('custom');
    });

    it('wires category select to handleCategoryFilterChange', () => {
        addEventListeners();
        // Add an option to make the value selectable
        const opt = document.createElement('option');
        opt.value = 'Casa';
        categorySelect.appendChild(opt);
        categorySelect.value = 'Casa';
        categorySelect.dispatchEvent(new Event('change'));
        expect(currentFilter.category).toBe('Casa');
    });

    it('wires text filter input to update currentFilter', () => {
        addEventListeners();
        textFilterInput.value = 'test search';
        textFilterInput.dispatchEvent(new Event('input'));
        expect(currentFilter.textFilter).toBe('test search');
    });

    it('wires add transaction button to openAddTransactionModal', () => {
        addEventListeners();
        addTransactionBtn.click();
        expect(addTransactionModal.style.display).toBe('block');
    });

    it('wires export button to exportToCSV', () => {
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
        transactions.push({ date: new Date(2025, 3, 12), description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' });
        addEventListeners();
        exportCsvBtn.click();
        expect(URL.createObjectURL).toHaveBeenCalled();
        vi.restoreAllMocks();
    });

    it('wires clear all button to confirmClearAll', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        transactions.push({ date: new Date(), description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' });
        addEventListeners();
        clearAllBtn.click();
        expect(transactions.length).toBe(0);
        vi.restoreAllMocks();
    });

    it('wires delete selected button to deleteSelectedTransactions', () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        addEventListeners();
        deleteSelectedBtn.click();
        // No transactions selected, so it alerts
        expect(alertSpy).toHaveBeenCalledWith('No transactions selected.');
        alertSpy.mockRestore();
    });

    it('wires sortable table headers to handleSort', () => {
        addEventListeners();
        const dateTh = document.querySelector('th[data-sort="date"]');
        // Default is date asc, clicking toggles to desc
        dateTh.click();
        expect(currentSort.direction).toBe('desc');
        expect(currentSort.field).toBe('date');
    });

    it('wires select all checkbox', () => {
        // First render some transactions to have checkboxes
        transactions.push(
            { date: new Date(), description: 'T1', amount: 10, type: 'expense', category: 'Casa', account: 'Amex' },
            { date: new Date(), description: 'T2', amount: 20, type: 'expense', category: 'Casa', account: 'Amex' }
        );
        renderTransactions();
        addEventListeners();

        selectAllCheckbox.checked = true;
        selectAllCheckbox.dispatchEvent(new Event('change'));

        const checkboxes = document.querySelectorAll('.transaction-checkbox');
        checkboxes.forEach(cb => expect(cb.checked).toBe(true));
    });

    it('wires amount-type radio buttons to populateTransactionCategorySelect', () => {
        addEventListeners();
        const incomeRadio = document.querySelector('input[name="amount-type"][value="income"]');
        incomeRadio.checked = true;
        incomeRadio.dispatchEvent(new Event('change'));
        // After change, category select should have income categories
        const options = Array.from(transactionCategorySelect.options);
        expect(options.some(o => o.value === 'Trabalho')).toBe(true);
    });

    it('wires transaction form submit', () => {
        addEventListeners();
        // Fill in minimal form data to prevent errors
        document.getElementById('transaction-date').value = '2025-04-12';
        document.getElementById('transaction-description').value = 'Test';
        document.getElementById('transaction-amount').value = '50';
        document.querySelector('input[name="amount-type"][value="expense"]').checked = true;
        // Populate categories so there's a valid selection
        const opt = document.createElement('option');
        opt.value = 'Casa';
        transactionCategorySelect.appendChild(opt);
        transactionCategorySelect.value = 'Casa';

        transactionForm.dispatchEvent(new Event('submit', { cancelable: true }));
        expect(transactions.length).toBe(1);
    });

    it('wires transaction category select change', () => {
        addEventListeners();
        // Add 'new' option if not present
        const opt = document.createElement('option');
        opt.value = 'new';
        transactionCategorySelect.appendChild(opt);
        transactionCategorySelect.value = 'new';
        transactionCategorySelect.dispatchEvent(new Event('change'));
        expect(document.getElementById('new-category-group').style.display).toBe('block');
    });

    it('wires close buttons to hide modals', () => {
        addTransactionModal.style.display = 'block';
        addEventListeners();
        const closeBtn = addTransactionModal.querySelector('.close');
        closeBtn.click();
        expect(addTransactionModal.style.display).toBe('none');
    });

    it('closes modal when clicking overlay', () => {
        // Arrange
        addEventListeners();
        addTransactionModal.style.display = 'block';

        // Act
        addTransactionModal.click();

        // Assert
        expect(addTransactionModal.style.display).toBe('none');
    });

    it('sorts from the button inside each sortable header', () => {
        // Arrange
        addEventListeners();
        const headers = document.querySelectorAll('th.sortable');
        const amountHeader = document.querySelector('th[data-sort="amount"]');

        // Act
        amountHeader.querySelector('button.sort-btn').click();

        // Assert
        expect(headers).toHaveLength(6);
        headers.forEach(th => expect(th.querySelector('button.sort-btn')).not.toBeNull());
        expect(currentSort).toMatchObject({ field: 'amount', direction: 'asc' });
        expect(amountHeader.getAttribute('aria-sort')).toBe('ascending');
    });

    it('closes the import result dialog with OK', () => {
        // Arrange
        const modal = document.getElementById('import-result-modal');
        addEventListeners();
        modal.style.display = 'block';

        // Act
        document.getElementById('import-result-ok').click();

        // Assert
        expect(modal.style.display).toBe('none');
    });
});
