import { describe, it, expect, vi } from 'vitest';

describe('addEventListeners', () => {
    it('wires import button to handleImport', () => {
        const spy = vi.spyOn(globalThis, 'handleImport').mockImplementation(() => {});
        addEventListeners();
        importBtn.click();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('wires date range select to handleDateRangeChange', () => {
        const spy = vi.spyOn(globalThis, 'handleDateRangeChange').mockImplementation(() => {});
        addEventListeners();
        dateRangeSelect.dispatchEvent(new Event('change'));
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('wires apply date filter button', () => {
        const spy = vi.spyOn(globalThis, 'applyCustomDateFilter').mockImplementation(() => {});
        addEventListeners();
        applyDateFilterBtn.click();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('wires category select to handleCategoryFilterChange', () => {
        const spy = vi.spyOn(globalThis, 'handleCategoryFilterChange').mockImplementation(() => {});
        addEventListeners();
        categorySelect.dispatchEvent(new Event('change'));
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('wires text filter input to update currentFilter', () => {
        // Need to mock renderTransactions and updateSummary
        vi.spyOn(globalThis, 'renderTransactions').mockImplementation(() => {});
        vi.spyOn(globalThis, 'updateSummary').mockImplementation(() => {});
        addEventListeners();
        textFilterInput.value = 'test search';
        textFilterInput.dispatchEvent(new Event('input'));
        expect(currentFilter.textFilter).toBe('test search');
        vi.restoreAllMocks();
    });

    it('wires add transaction button to openAddTransactionModal', () => {
        const spy = vi.spyOn(globalThis, 'openAddTransactionModal').mockImplementation(() => {});
        addEventListeners();
        addTransactionBtn.click();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('wires export button to exportToCSV', () => {
        const spy = vi.spyOn(globalThis, 'exportToCSV').mockImplementation(() => {});
        addEventListeners();
        exportCsvBtn.click();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('wires clear all button to confirmClearAll', () => {
        const spy = vi.spyOn(globalThis, 'confirmClearAll').mockImplementation(() => {});
        addEventListeners();
        clearAllBtn.click();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('wires delete selected button to deleteSelectedTransactions', () => {
        const spy = vi.spyOn(globalThis, 'deleteSelectedTransactions').mockImplementation(() => {});
        addEventListeners();
        deleteSelectedBtn.click();
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('wires sortable table headers to handleSort', () => {
        const spy = vi.spyOn(globalThis, 'handleSort').mockImplementation(() => {});
        addEventListeners();
        const dateTh = document.querySelector('th[data-sort="date"]');
        dateTh.click();
        expect(spy).toHaveBeenCalledWith('date');
        spy.mockRestore();
    });

    it('wires select all checkbox', () => {
        // First render some transactions to have checkboxes
        transactions = [
            { date: new Date(), description: 'T1', amount: 10, type: 'expense', category: 'Casa', account: 'Amex' },
            { date: new Date(), description: 'T2', amount: 20, type: 'expense', category: 'Casa', account: 'Amex' }
        ];
        renderTransactions();
        addEventListeners();

        selectAllCheckbox.checked = true;
        selectAllCheckbox.dispatchEvent(new Event('change'));

        const checkboxes = document.querySelectorAll('.transaction-checkbox');
        checkboxes.forEach(cb => expect(cb.checked).toBe(true));
    });

    it('wires amount-type radio buttons to populateTransactionCategorySelect', () => {
        const spy = vi.spyOn(globalThis, 'populateTransactionCategorySelect').mockImplementation(() => {});
        addEventListeners();
        const radio = document.querySelector('input[name="amount-type"]');
        radio.dispatchEvent(new Event('change'));
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('wires transaction form submit', () => {
        const spy = vi.spyOn(globalThis, 'handleAddTransaction').mockImplementation((e) => e.preventDefault());
        addEventListeners();
        transactionForm.dispatchEvent(new Event('submit', { cancelable: true }));
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('wires transaction category select change', () => {
        const spy = vi.spyOn(globalThis, 'handleCategorySelectChange').mockImplementation(() => {});
        addEventListeners();
        transactionCategorySelect.dispatchEvent(new Event('change'));
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('wires close buttons to hide modals', () => {
        addTransactionModal.style.display = 'block';
        addEventListeners();
        const closeBtn = addTransactionModal.querySelector('.close');
        closeBtn.click();
        expect(addTransactionModal.style.display).toBe('none');
    });

    it('closes modal when clicking overlay', () => {
        addEventListeners();
        addTransactionModal.style.display = 'block';
        addTransactionModal.classList.add('modal');
        // Simulate click on the modal overlay itself
        const event = new Event('click', { bubbles: true });
        Object.defineProperty(event, 'target', { value: addTransactionModal });
        window.dispatchEvent(event);
        expect(addTransactionModal.style.display).toBe('none');
    });
});
