import { describe, it, expect, vi } from 'vitest';
import { categoryKeywords, categorizeTransaction, populateCategoryDropdowns, populateTransactionCategorySelect, handleCategorySelectChange, handleCategoryFilterChange } from '../js/categories.js';
import { categorySelect, transactionCategorySelect, newCategoryGroup } from '../js/dom.js';
import { currentFilter, settings } from '../js/state.js';
import { emptySettings } from '../js/settings.js';
import { UNCATEGORIZED } from '../js/category-engine.js';

describe('static data', () => {
    it('categoryKeywords has expense and income keys', () => {
        expect(categoryKeywords).toHaveProperty('expense');
        expect(categoryKeywords).toHaveProperty('income');
    });
});

describe('categorizeTransaction with the Settings category list', () => {
    it('never returns a category missing from Settings', () => {
        // Arrange
        settings.categories.expense = ['Mercado', UNCATEGORIZED];

        // Act, Assert
        expect(categorizeTransaction('hotel booking', 'expense')).toBe(UNCATEGORIZED);
        expect(categorizeTransaction('COSTCO WHOLESALE', 'expense')).toBe('Mercado');
    });

    it('follows categories added to Settings at runtime', () => {
        // Arrange
        settings.categories.expense = [UNCATEGORIZED];
        const before = categorizeTransaction('COSTCO WHOLESALE', 'expense');

        // Act
        settings.categories.expense.unshift('Mercado');

        // Assert
        expect(before).toBe(UNCATEGORIZED);
        expect(categorizeTransaction('COSTCO WHOLESALE', 'expense')).toBe('Mercado');
    });

    it('routes an income matching an expense keyword to Reembolso when it exists', () => {
        // Act, Assert
        expect(categorizeTransaction('COSTCO WHOLESALE', 'income')).toBe('Reembolso');
    });

    it('leaves that income uncategorized when Reembolso is not in Settings', () => {
        // Arrange
        settings.categories.income = ['Trabalho', UNCATEGORIZED];

        // Act, Assert
        expect(categorizeTransaction('COSTCO WHOLESALE', 'income')).toBe(UNCATEGORIZED);
    });

    it('returns Sem Categoria for an unknown type', () => {
        // Act, Assert
        expect(categorizeTransaction('COSTCO WHOLESALE', 'transfer')).toBe(UNCATEGORIZED);
    });

    it('categorizes everything as Sem Categoria on a fresh install', () => {
        // Arrange
        settings.categories = emptySettings().categories;

        // Act, Assert
        expect(categorizeTransaction('COSTCO WHOLESALE', 'expense')).toBe(UNCATEGORIZED);
        expect(categorizeTransaction('PAYROLL DEPOSIT', 'income')).toBe(UNCATEGORIZED);
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
        // 'student loan' appears in both Dívida and Empréstimo keywords;
        // Dívida comes first in iteration order, so it wins.
        expect(categorizeTransaction('student loan payment', 'expense')).toBe('Dívida');
    });
});

describe('populateCategoryDropdowns', () => {
    it('keeps the category the list is filtered on when it rebuilds the options', () => {
        // Arrange
        populateCategoryDropdowns();
        currentFilter.category = 'Casa';
        categorySelect.value = 'Casa';

        // Act
        populateCategoryDropdowns();

        // Assert
        expect(categorySelect.value).toBe('Casa');
        expect(currentFilter.category).toBe('Casa');
    });

    it('goes back to all categories when the filtered one no longer exists', () => {
        // Arrange
        currentFilter.category = 'Removed';

        // Act
        populateCategoryDropdowns();

        // Assert
        expect(categorySelect.value).toBe('all');
        expect(currentFilter.category).toBe('all');
    });

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
        settings.categories.expense.forEach(cat => {
            const found = Array.from(options).some(opt => opt.value === cat);
            expect(found).toBe(true);
        });
    });

    it('includes all income categories as options', () => {
        populateCategoryDropdowns();
        const incomeOptgroup = categorySelect.querySelector('optgroup[label="Income"]');
        const options = incomeOptgroup.querySelectorAll('option');
        settings.categories.income.forEach(cat => {
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
        settings.categories.expense.forEach(cat => {
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
        settings.categories.income.forEach(cat => {
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

describe('dropdowns follow the Settings category list', () => {
    it('lists a category added to Settings', () => {
        // Arrange
        settings.categories.expense = ['Pets', UNCATEGORIZED];

        // Act
        populateCategoryDropdowns();

        // Assert
        const values = Array.from(categorySelect.querySelectorAll('optgroup[label="Expenses"] option')).map(o => o.value);
        expect(values).toEqual(['Pets', UNCATEGORIZED]);
    });
});
