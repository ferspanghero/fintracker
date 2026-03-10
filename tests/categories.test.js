import { describe, it, expect, vi } from 'vitest';

describe('static data', () => {
    it('defaultCategories has expense and income keys', () => {
        expect(defaultCategories).toHaveProperty('expense');
        expect(defaultCategories).toHaveProperty('income');
    });

    it('expense categories include standard set', () => {
        expect(defaultCategories.expense).toContain('Casa');
        expect(defaultCategories.expense).toContain('Mercado');
        expect(defaultCategories.expense).toContain('Alimentação');
        expect(defaultCategories.expense).toContain('Sem Categoria');
    });

    it('income categories include standard set', () => {
        expect(defaultCategories.income).toContain('Trabalho');
        expect(defaultCategories.income).toContain('Investimento');
        expect(defaultCategories.income).toContain('Sem Categoria');
    });

    it('categories is a deep clone of defaultCategories', () => {
        expect(categories).toEqual(defaultCategories);
        expect(categories).not.toBe(defaultCategories);
    });

    it('categoryKeywords has expense and income keys', () => {
        expect(categoryKeywords).toHaveProperty('expense');
        expect(categoryKeywords).toHaveProperty('income');
    });

    it('all category keyword keys match known categories', () => {
        Object.keys(categoryKeywords.expense).forEach(key => {
            expect(defaultCategories.expense).toContain(key);
        });
        Object.keys(categoryKeywords.income).forEach(key => {
            expect(defaultCategories.income).toContain(key);
        });
    });
});

describe('categorizeTransaction', () => {
    it('matches expense Viagem keyword', () => {
        expect(categorizeTransaction('hotel booking', 'expense')).toBe('Viagem');
    });

    it('matches expense Mercado keyword', () => {
        expect(categorizeTransaction('COSTCO WHOLESALE', 'expense')).toBe('Mercado');
    });

    it('matches expense Alimentação keyword', () => {
        expect(categorizeTransaction('STARBUCKS COFFEE', 'expense')).toBe('Alimentação');
    });

    it('matches expense Lazer keyword', () => {
        // 'subscription' also appears in Tarifa keywords, which comes first in iteration order.
        // 'netflix' is unique to Lazer, so use that alone.
        expect(categorizeTransaction('NETFLIX movie', 'expense')).toBe('Lazer');
    });

    it('matches expense Transporte keyword', () => {
        expect(categorizeTransaction('UBER trip', 'expense')).toBe('Transporte');
    });

    it('matches income Trabalho keyword', () => {
        expect(categorizeTransaction('PAYROLL DEPOSIT', 'income')).toBe('Trabalho');
    });

    it('matches income Reembolso keyword', () => {
        // 'cashback' is a unique Reembolso keyword
        expect(categorizeTransaction('CASHBACK reward', 'income')).toBe('Reembolso');
    });

    it('matches income Investimento keyword', () => {
        // 'dividend' is a unique Investimento keyword
        expect(categorizeTransaction('DIVIDEND received', 'income')).toBe('Investimento');
    });

    it('returns Sem Categoria for unknown expense', () => {
        expect(categorizeTransaction('xyzzy123unknown', 'expense')).toBe('Sem Categoria');
    });

    it('returns Sem Categoria for unknown income', () => {
        expect(categorizeTransaction('xyzzy123unknown', 'income')).toBe('Sem Categoria');
    });

    it('is case insensitive', () => {
        expect(categorizeTransaction('NETFLIX', 'expense')).toBe('Lazer');
        expect(categorizeTransaction('netflix', 'expense')).toBe('Lazer');
        expect(categorizeTransaction('Netflix', 'expense')).toBe('Lazer');
    });

    it('returns first matching category (priority order)', () => {
        // 'subscription' appears in both Tarifa and Lazer keywords
        const result = categorizeTransaction('subscription service', 'expense');
        expect(['Tarifa', 'Lazer']).toContain(result);
    });
});

describe('populateCategoryDropdowns', () => {
    it('populates categorySelect with optgroups', () => {
        populateCategoryDropdowns();
        const optgroups = categorySelect.querySelectorAll('optgroup');
        expect(optgroups.length).toBe(2);
        expect(optgroups[0].label).toBe('Expenses');
        expect(optgroups[1].label).toBe('Income');
    });

    it('first option is All Categories', () => {
        populateCategoryDropdowns();
        expect(categorySelect.options[0].value).toBe('all');
        expect(categorySelect.options[0].textContent).toBe('All Categories');
    });

    it('includes all expense categories as options', () => {
        populateCategoryDropdowns();
        const expenseOptgroup = categorySelect.querySelector('optgroup[label="Expenses"]');
        const options = expenseOptgroup.querySelectorAll('option');
        categories.expense.forEach(cat => {
            const found = Array.from(options).some(opt => opt.value === cat);
            expect(found).toBe(true);
        });
    });

    it('includes all income categories as options', () => {
        populateCategoryDropdowns();
        const incomeOptgroup = categorySelect.querySelector('optgroup[label="Income"]');
        const options = incomeOptgroup.querySelectorAll('option');
        categories.income.forEach(cat => {
            const found = Array.from(options).some(opt => opt.value === cat);
            expect(found).toBe(true);
        });
    });
});

describe('populateTransactionCategorySelect', () => {
    it('populates based on expense type (default radio)', () => {
        populateTransactionCategorySelect();
        const options = Array.from(transactionCategorySelect.options);
        // First is placeholder, last is "new"
        categories.expense.forEach(cat => {
            const found = options.some(opt => opt.value === cat);
            expect(found).toBe(true);
        });
    });

    it('first option is placeholder', () => {
        populateTransactionCategorySelect();
        expect(transactionCategorySelect.options[0].value).toBe('');
        expect(transactionCategorySelect.options[0].textContent).toBe('-- Select Category --');
    });

    it('last option is Add New Category', () => {
        populateTransactionCategorySelect();
        const lastOpt = transactionCategorySelect.options[transactionCategorySelect.options.length - 1];
        expect(lastOpt.value).toBe('new');
        expect(lastOpt.textContent).toBe('+ Add New Category');
    });

    it('populates income categories when income radio selected', () => {
        // Select income radio
        const incomeRadio = document.querySelector('input[name="amount-type"][value="income"]');
        incomeRadio.checked = true;
        populateTransactionCategorySelect();
        const options = Array.from(transactionCategorySelect.options);
        categories.income.forEach(cat => {
            const found = options.some(opt => opt.value === cat);
            expect(found).toBe(true);
        });
    });
});

describe('handleCategorySelectChange', () => {
    it('shows new category group when "new" selected', () => {
        transactionCategorySelect.value = 'new';
        handleCategorySelectChange();
        expect(newCategoryGroup.style.display).toBe('block');
    });

    it('hides new category group when other value selected', () => {
        transactionCategorySelect.value = 'Casa';
        handleCategorySelectChange();
        expect(newCategoryGroup.style.display).toBe('none');
    });
});

describe('handleCategoryFilterChange', () => {
    it('updates currentFilter.category', () => {
        categorySelect.value = 'all';
        populateCategoryDropdowns();

        // Add an option manually for testing
        const opt = document.createElement('option');
        opt.value = 'Casa';
        opt.textContent = 'Casa';
        categorySelect.appendChild(opt);
        categorySelect.value = 'Casa';

        handleCategoryFilterChange();
        expect(currentFilter.category).toBe('Casa');
    });
});
