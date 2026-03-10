import { describe, it, expect, vi } from 'vitest';

describe('getTransactionKey', () => {
    it('generates key from transaction fields', () => {
        const txn = {
            date: new Date(2025, 3, 12),
            description: 'Test',
            amount: 50,
            type: 'expense',
            account: 'Amex'
        };
        const key = getTransactionKey(txn);
        expect(key).toBe('2025-04-12-Test-50-expense-Amex');
    });

    it('generates different keys for different amounts', () => {
        const txn1 = { date: new Date(2025, 3, 12), description: 'Test', amount: 50, type: 'expense', account: 'Amex' };
        const txn2 = { date: new Date(2025, 3, 12), description: 'Test', amount: 100, type: 'expense', account: 'Amex' };
        expect(getTransactionKey(txn1)).not.toBe(getTransactionKey(txn2));
    });

    it('generates different keys for different types', () => {
        const txn1 = { date: new Date(2025, 3, 12), description: 'Test', amount: 50, type: 'expense', account: 'Amex' };
        const txn2 = { date: new Date(2025, 3, 12), description: 'Test', amount: 50, type: 'income', account: 'Amex' };
        expect(getTransactionKey(txn1)).not.toBe(getTransactionKey(txn2));
    });

    it('generates different keys for different accounts', () => {
        const txn1 = { date: new Date(2025, 3, 12), description: 'Test', amount: 50, type: 'expense', account: 'Amex' };
        const txn2 = { date: new Date(2025, 3, 12), description: 'Test', amount: 50, type: 'expense', account: 'TD' };
        expect(getTransactionKey(txn1)).not.toBe(getTransactionKey(txn2));
    });
});

describe('getFilteredTransactions', () => {
    const makeTxn = (overrides) => ({
        date: new Date(2025, 3, 12),
        description: 'Test',
        amount: 50,
        type: 'expense',
        category: 'Casa',
        account: 'Amex',
        ...overrides
    });

    it('returns all transactions with default filter', () => {
        transactions = [makeTxn(), makeTxn(), makeTxn()];
        const result = getFilteredTransactions();
        expect(result.length).toBe(3);
    });

    it('filters by startDate', () => {
        transactions = [
            makeTxn({ date: new Date(2025, 0, 1) }),
            makeTxn({ date: new Date(2025, 5, 1) })
        ];
        currentFilter.startDate = new Date(2025, 3, 1);
        const result = getFilteredTransactions();
        expect(result.length).toBe(1);
        expect(result[0].date.getMonth()).toBe(5);
    });

    it('filters by endDate (inclusive end of day)', () => {
        transactions = [
            makeTxn({ date: new Date(2025, 0, 1) }),
            makeTxn({ date: new Date(2025, 5, 1) })
        ];
        currentFilter.endDate = new Date(2025, 3, 1);
        const result = getFilteredTransactions();
        expect(result.length).toBe(1);
        expect(result[0].date.getMonth()).toBe(0);
    });

    it('filters by both start and end date', () => {
        transactions = [
            makeTxn({ date: new Date(2025, 0, 1) }),
            makeTxn({ date: new Date(2025, 3, 15) }),
            makeTxn({ date: new Date(2025, 8, 1) })
        ];
        currentFilter.startDate = new Date(2025, 2, 1);
        currentFilter.endDate = new Date(2025, 5, 30);
        const result = getFilteredTransactions();
        expect(result.length).toBe(1);
        expect(result[0].date.getMonth()).toBe(3);
    });

    it('filters by category', () => {
        transactions = [
            makeTxn({ category: 'Casa' }),
            makeTxn({ category: 'Mercado' }),
            makeTxn({ category: 'Casa' })
        ];
        currentFilter.category = 'Casa';
        const result = getFilteredTransactions();
        expect(result.length).toBe(2);
        result.forEach(t => expect(t.category).toBe('Casa'));
    });

    it('returns all categories when filter is "all"', () => {
        transactions = [
            makeTxn({ category: 'Casa' }),
            makeTxn({ category: 'Mercado' })
        ];
        currentFilter.category = 'all';
        const result = getFilteredTransactions();
        expect(result.length).toBe(2);
    });

    it('filters by text matching description', () => {
        transactions = [
            makeTxn({ description: 'STARBUCKS COFFEE' }),
            makeTxn({ description: 'COSTCO' })
        ];
        currentFilter.textFilter = 'starbucks';
        const result = getFilteredTransactions();
        expect(result.length).toBe(1);
        expect(result[0].description).toBe('STARBUCKS COFFEE');
    });

    it('filters by text matching category', () => {
        transactions = [
            makeTxn({ description: 'Something', category: 'Mercado' }),
            makeTxn({ description: 'Something', category: 'Casa' })
        ];
        currentFilter.textFilter = 'mercado';
        const result = getFilteredTransactions();
        expect(result.length).toBe(1);
    });

    it('filters by text matching account', () => {
        transactions = [
            makeTxn({ account: 'Amex' }),
            makeTxn({ account: 'TD' })
        ];
        currentFilter.textFilter = 'amex';
        const result = getFilteredTransactions();
        expect(result.length).toBe(1);
    });

    it('text filter is case insensitive', () => {
        transactions = [makeTxn({ description: 'STARBUCKS' })];
        currentFilter.textFilter = 'STARBUCKS';
        expect(getFilteredTransactions().length).toBe(1);
        currentFilter.textFilter = 'starbucks';
        expect(getFilteredTransactions().length).toBe(1);
    });

    it('combined filters work together', () => {
        transactions = [
            makeTxn({ date: new Date(2025, 3, 12), category: 'Casa', description: 'Home Repair' }),
            makeTxn({ date: new Date(2025, 3, 12), category: 'Mercado', description: 'Groceries' }),
            makeTxn({ date: new Date(2025, 0, 1), category: 'Casa', description: 'Old Home' })
        ];
        currentFilter.startDate = new Date(2025, 2, 1);
        currentFilter.category = 'Casa';
        currentFilter.textFilter = 'repair';
        const result = getFilteredTransactions();
        expect(result.length).toBe(1);
        expect(result[0].description).toBe('Home Repair');
    });
});

describe('openAddTransactionModal', () => {
    it('shows the modal', () => {
        openAddTransactionModal();
        expect(addTransactionModal.style.display).toBe('block');
    });

    it('sets today as default date', () => {
        openAddTransactionModal();
        const today = new Date().toISOString().split('T')[0];
        expect(transactionDateInput.value).toBe(today);
    });

    it('hides new category group', () => {
        openAddTransactionModal();
        expect(newCategoryGroup.style.display).toBe('none');
    });
});

describe('handleAddTransaction', () => {
    function fillForm({ date, description, amount, type = 'expense', category, account = 'Amex' }) {
        transactionDateInput.value = date || '2025-04-12';
        transactionDescriptionInput.value = description || 'Test';
        transactionAmountInput.value = amount || '50';
        transactionAccountSelect.value = account;

        // Set type radio
        const radio = document.querySelector(`input[name="amount-type"][value="${type}"]`);
        radio.checked = true;

        // Populate and set category
        populateTransactionCategorySelect();
        if (category) {
            transactionCategorySelect.value = category;
        } else {
            transactionCategorySelect.value = categories[type][0];
        }
    }

    it('adds a transaction to the array', () => {
        fillForm({ description: 'Test Purchase', amount: '75.50' });
        const event = new Event('submit', { cancelable: true });
        handleAddTransaction(event);
        expect(transactions.length).toBe(1);
        expect(transactions[0].description).toBe('Test Purchase');
        expect(transactions[0].amount).toBe(75.50);
    });

    it('closes modal after adding', () => {
        fillForm({});
        handleAddTransaction(new Event('submit', { cancelable: true }));
        expect(addTransactionModal.style.display).toBe('none');
    });

    it('sets correct transaction type', () => {
        fillForm({ type: 'income' });
        handleAddTransaction(new Event('submit', { cancelable: true }));
        expect(transactions[0].type).toBe('income');
    });

    it('handles new category creation', () => {
        fillForm({});
        transactionCategorySelect.value = 'new';
        newCategoryNameInput.value = 'Custom Category';
        // Set category type radio
        document.querySelector('input[name="category-type"][value="expense"]').checked = true;

        handleAddTransaction(new Event('submit', { cancelable: true }));
        expect(transactions[0].category).toBe('Custom Category');
        expect(categories.expense).toContain('Custom Category');
    });

    it('alerts when new category name is empty', () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        fillForm({});
        transactionCategorySelect.value = 'new';
        newCategoryNameInput.value = '';

        handleAddTransaction(new Event('submit', { cancelable: true }));
        expect(alertSpy).toHaveBeenCalledWith('Please enter a name for the new category.');
        expect(transactions.length).toBe(0);
        alertSpy.mockRestore();
    });
});

describe('updateTransactionField', () => {
    it('updates description field', () => {
        transactions = [{ date: new Date(), description: 'Old', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }];
        updateTransactionField(0, 'description', 'New Description');
        expect(transactions[0].description).toBe('New Description');
    });

    it('updates date field', () => {
        transactions = [{ date: new Date(2025, 0, 1), description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }];
        updateTransactionField(0, 'date', '2025-06-15');
        expect(transactions[0].date).toBeInstanceOf(Date);
    });

    it('updates amount field as float', () => {
        transactions = [{ date: new Date(), description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }];
        updateTransactionField(0, 'amount', '75.50');
        expect(transactions[0].amount).toBe(75.50);
    });

    it('updates category field', () => {
        transactions = [{ date: new Date(), description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }];
        updateTransactionField(0, 'category', 'Mercado');
        expect(transactions[0].category).toBe('Mercado');
    });
});

describe('deleteTransaction', () => {
    it('removes transaction when confirmed', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        transactions = [
            { date: new Date(), description: 'First', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' },
            { date: new Date(), description: 'Second', amount: 100, type: 'expense', category: 'Casa', account: 'Amex' }
        ];
        deleteTransaction(0);
        expect(transactions.length).toBe(1);
        expect(transactions[0].description).toBe('Second');
        window.confirm.mockRestore();
    });

    it('does not remove when cancelled', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        transactions = [{ date: new Date(), description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }];
        deleteTransaction(0);
        expect(transactions.length).toBe(1);
        window.confirm.mockRestore();
    });
});

describe('deleteSelectedTransactions', () => {
    it('alerts when no transactions selected', () => {
        const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
        deleteSelectedTransactions();
        expect(alertSpy).toHaveBeenCalledWith('No transactions selected.');
        alertSpy.mockRestore();
    });

    it('deletes selected transactions', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        transactions = [
            { date: new Date(), description: 'First', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' },
            { date: new Date(), description: 'Second', amount: 100, type: 'expense', category: 'Casa', account: 'Amex' },
            { date: new Date(), description: 'Third', amount: 150, type: 'expense', category: 'Casa', account: 'Amex' }
        ];
        renderTransactions();

        // Check first and third checkboxes
        const checkboxes = transactionsBody.querySelectorAll('.transaction-checkbox');
        checkboxes[0].checked = true;
        checkboxes[2].checked = true;

        deleteSelectedTransactions();
        expect(transactions.length).toBe(1);
        expect(transactions[0].description).toBe('Second');
        window.confirm.mockRestore();
    });
});

describe('confirmClearAll', () => {
    it('clears all transactions when confirmed', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        transactions = [
            { date: new Date(), description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }
        ];
        confirmClearAll();
        expect(transactions.length).toBe(0);
        window.confirm.mockRestore();
    });

    it('preserves transactions when cancelled', () => {
        vi.spyOn(window, 'confirm').mockReturnValue(false);
        transactions = [
            { date: new Date(), description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }
        ];
        confirmClearAll();
        expect(transactions.length).toBe(1);
        window.confirm.mockRestore();
    });
});
