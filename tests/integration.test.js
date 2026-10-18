import { describe, it, expect, vi } from 'vitest';
import { parseCSV, convertTransactionsToCSV } from '../js/import-export.js';
import { getFilteredTransactions } from '../js/transactions.js';
import { getTransactionKey } from '../js/import-export.js';
import { transactions, currentFilter, currentSort, settings } from '../js/state.js';
import { emptySettings } from '../js/settings.js';
import { SAMPLE_CATEGORIES } from './fixtures/sample-categories.js';
import { transactionsBody, dateRangeSelect } from '../js/dom.js';
import { init } from '../js/main.js';

describe('Integration: CSV import and parsing', () => {
    it('imports Amex CSV and populates transactions', () => {
        const csv = [
            'Date,Date Processed,Description,Amount',
            '28 Feb 2025,28 Feb 2025,STARBUCKS COFFEE,12.50',
            '01 Mar 2025,01 Mar 2025,PAYMENT RECEIVED,-500.00',
            '05 Mar 2025,05 Mar 2025,UBER TRIP,25.00'
        ].join('\n');

        const result = parseCSV(csv, 'amex');
        expect(result.transactions.length).toBe(3);

        // Verify first transaction
        expect(result.transactions[0].description).toBe('STARBUCKS COFFEE');
        expect(result.transactions[0].type).toBe('expense');
        expect(result.transactions[0].amount).toBe(12.50);

        // Verify payment (income)
        expect(result.transactions[1].type).toBe('income');
        expect(result.transactions[1].amount).toBe(500);

        // Verify categories were assigned
        result.transactions.forEach(txn => {
            expect(txn.category).toBeTruthy();
        });
    });

    it('imports Mastercard CSV', () => {
        const csv = [
            'Description,Type,Card Holder Name,Date,Time,Amount',
            'COSTCO WHOLESALE,PURCHASE,JOHN DOE,2/15/2025,2:30 PM,-150.00',
            'ONLINE PAYMENT,PAYMENT,JOHN DOE,2/20/2025,10:00 AM,500.00'
        ].join('\n');

        const result = parseCSV(csv, 'mastercard');
        expect(result.transactions.length).toBe(2);
        expect(result.transactions[0].type).toBe('expense');
        expect(result.transactions[0].description).toContain('JOHN DOE');
        expect(result.transactions[1].type).toBe('income');
    });

    it('auto-detects a Mastercard export with quoted fields', () => {
        const csv = [
            '"Description","Type","Card Holder Name","Date","Time","Amount"',
            '"SENTINEL STORE","PURCHASE","JOHN DOE","02/15/2025","02:30 PM","-150.00"',
            '"SENTINEL CARD PAYMENT","PAYMENT","JOHN DOE","02/16/2025","09:00 AM","20.00"',
            '"SENTINEL STORE","REFUND","JOHN DOE","02/17/2025","04:00 AM","40.00"'
        ].join('\r\n');

        const result = parseCSV('\uFEFF' + csv, 'auto');

        expect(result.transactions.map(t => [t.description, t.account, t.amount, t.type])).toEqual([
            ['SENTINEL STORE (JOHN DOE)', 'Mastercard', 150, 'expense'],
            ['SENTINEL CARD PAYMENT (JOHN DOE)', 'Mastercard', 20, 'income'],
            ['SENTINEL STORE (JOHN DOE)', 'Mastercard', 40, 'income']
        ]);
    });

    it('imports TD CSV (no header)', () => {
        const csv = [
            '2/18/2025,TIM HORTONS,5.50,,5274.51',
            '2/19/2025,DIRECT DEPOSIT,,2000.00,7274.51'
        ].join('\n');

        const result = parseCSV(csv, 'td');
        expect(result.transactions.length).toBe(2);
        expect(result.transactions[0].type).toBe('expense');
        expect(result.transactions[1].type).toBe('income');
    });

    it('imports Bradesco CSV with semicolons and BRL conversion', () => {
        const csv = [
            'Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)',
            '28/02/2025;SALDO ANTERIOR;0;0,00; ;2.279,37',
            '01/03/2025;SALARIO;12345;5.000,00;;7.279,37',
            '02/03/2025;MERCADO PAG;67890;;200,00;7.079,37'
        ].join('\n');
        settings.rates.BRL = 0.3;

        const result = parseCSV(csv, 'bradesco');
        // SALDO ANTERIOR has 0 credit and space for debit, should be skipped
        expect(result.transactions.length).toBe(2);
        expect(result.transactions[0].type).toBe('income');
        expect(result.transactions[0].amount).toBeCloseTo(1500);
        expect(result.transactions[1].type).toBe('expense');
    });

    it('auto-detects a Bradesco export that starts with an account title row', () => {
        const csv = [
            'Extrato de: Ag: 0000 | Conta: 000000-0;;;;;',
            'Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)',
            '31/08/2025;COD. LANC. 0;0;0,00; ;1.000,00',
            '23/09/2025;INCOME SENTINEL;2;1,50; ;1.001,50',
            '23/09/2025;EXPENSE SENTINEL A;111; ;500,00;501,50',
            '23/09/2025;EXPENSE SENTINEL B;111; ;10,00;491,50',
            ';;;;;',
            'Filtro de resultados - Movimentação entre:  01/09/2025 e 30/09/2025;;;;;',
            'Os dados acima tem como base 07/10/2025 às 02:38 e estão sujeitos a alterações.;;;;;',
            'Últimos Lancamentos;;;;;',
            'Data;Histórico;Docto.;Crédito (R$);Débito (R$);',
            '23/09/2025;COD. LANC. 0;0; ; ;491,50',
            '07/10/2025;PIX SENTINEL;222; ;40,00;451,50',
            '',
            ';;Total;0,00;40,00;451,50;'
        ].join('\r\n');
        settings.rates.BRL = 0.3;

        const result = parseCSV(csv, 'auto');

        expect(result.errorCount).toBe(0);
        expect(result.transactions.map(t => [t.description, t.type])).toEqual([
            ['INCOME SENTINEL', 'income'],
            ['EXPENSE SENTINEL A', 'expense'],
            ['EXPENSE SENTINEL B', 'expense'],
            ['PIX SENTINEL', 'expense']
        ]);
        expect(result.transactions.every(t => t.account === 'Bradesco')).toBe(true);
    });
});

describe('Integration: Bradesco without a BRL rate', () => {
    it('refuses the whole file up front', () => {
        // Arrange
        settings.rates.BRL = null;
        const csv = 'Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)\n01/03/2025;SALARIO;12345;5.000,00;;7.279,37';

        // Act, Assert
        expect(() => parseCSV(csv, 'auto')).toThrow('Set the BRL → CAD rate in Settings before importing Bradesco files.');
    });

    it('passes an explicit context through to the parser', () => {
        // Arrange
        const csv = 'Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)\n01/03/2025;SALARIO;12345;100,00;;7.279,37';

        // Act
        const result = parseCSV(csv, 'bradesco', { rates: { BRL: 0.5 } });

        // Assert
        expect(result.transactions[0].amount).toBeCloseTo(50);
    });
});

describe('Integration: export then re-import round-trip', () => {
    it('exported data can be re-imported via fintracker format', () => {
        // Create original transactions
        const original = [
            { date: new Date(2025, 3, 12), description: 'Coffee Shop', amount: 5.50, type: 'expense', category: 'Alimentação', account: 'Amex' },
            { date: new Date(2025, 3, 15), description: 'Salary', amount: 3000, type: 'income', category: 'Trabalho', account: 'TD' }
        ];

        // Export
        const csv = convertTransactionsToCSV(original);

        // Re-import (strip BOM for parsing)
        const csvContent = csv.replace(/^\uFEFF/, '');
        const reimported = parseCSV(csvContent, 'fintracker');

        expect(reimported.transactions.length).toBe(2);

        // Verify data matches
        expect(reimported.transactions[0].description).toBe('Coffee Shop');
        expect(reimported.transactions[0].amount).toBe(5.50);
        expect(reimported.transactions[0].type).toBe('expense');
        expect(reimported.transactions[0].category).toBe('Alimentação');
        expect(reimported.transactions[0].account).toBe('Amex');

        expect(reimported.transactions[1].description).toBe('Salary');
        expect(reimported.transactions[1].amount).toBe(3000);
        expect(reimported.transactions[1].type).toBe('income');
    });
});

describe('Integration: duplicate detection', () => {
    it('detects duplicate transactions by key', () => {
        const txn1 = { date: new Date(2025, 3, 12), description: 'Test', amount: 50, type: 'expense', account: 'Amex' };
        const txn2 = { date: new Date(2025, 3, 12), description: 'Test', amount: 50, type: 'expense', account: 'Amex' };
        const txn3 = { date: new Date(2025, 3, 13), description: 'Different', amount: 100, type: 'income', account: 'TD' };

        expect(getTransactionKey(txn1)).toBe(getTransactionKey(txn2));
        expect(getTransactionKey(txn1)).not.toBe(getTransactionKey(txn3));
    });

    it('import deduplication works via key set', () => {
        // Simulate what processFiles does for duplicate detection
        transactions.push(
            { date: new Date(2025, 3, 12), description: 'Existing', amount: 50, type: 'expense', account: 'Amex' }
        );
        const transactionKeys = new Set(transactions.map(getTransactionKey));

        const imported = [
            // Duplicate of existing
            { date: new Date(2025, 3, 12), description: 'Existing', amount: 50, type: 'expense', account: 'Amex' },
            // New transaction
            { date: new Date(2025, 3, 15), description: 'New', amount: 100, type: 'expense', account: 'TD' }
        ];

        let added = 0;
        let duplicates = 0;
        imported.forEach(txn => {
            if (!transactionKeys.has(getTransactionKey(txn))) {
                transactions.push(txn);
                added++;
            } else {
                duplicates++;
            }
        });

        expect(added).toBe(1);
        expect(duplicates).toBe(1);
        expect(transactions.length).toBe(2);
    });
});

describe('Integration: filter after import', () => {
    it('filters imported transactions by date range', () => {
        const csv = [
            'Date,Date Processed,Description,Amount',
            '15 Jan 2025,15 Jan 2025,January Purchase,10.00',
            '15 Mar 2025,15 Mar 2025,March Purchase,20.00',
            '15 Jun 2025,15 Jun 2025,June Purchase,30.00'
        ].join('\n');

        const parsed = parseCSV(csv, 'amex');
        transactions.push(...parsed.transactions);
        expect(transactions.length).toBe(3);

        // Filter to March-April only
        currentFilter.startDate = new Date(2025, 2, 1);
        currentFilter.endDate = new Date(2025, 3, 30);
        const filtered = getFilteredTransactions();
        expect(filtered.length).toBe(1);
        expect(filtered[0].description).toBe('March Purchase');
    });

    it('filters imported transactions by text search', () => {
        const csv = [
            'Date,Date Processed,Description,Amount',
            '15 Jan 2025,15 Jan 2025,STARBUCKS COFFEE,5.00',
            '15 Jan 2025,15 Jan 2025,COSTCO WHOLESALE,150.00'
        ].join('\n');

        const parsed = parseCSV(csv, 'amex');
        transactions.push(...parsed.transactions);
        currentFilter.textFilter = 'starbucks';
        const filtered = getFilteredTransactions();
        expect(filtered.length).toBe(1);
        expect(filtered[0].description).toBe('STARBUCKS COFFEE');
    });
});

describe('Integration: full init cycle', () => {
    it('initializes app with pre-populated localStorage', () => {
        // Pre-populate localStorage
        const savedTxns = [
            { date: new Date(2025, 3, 12).toISOString(), description: 'Saved', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }
        ];
        localStorage.setItem('transactions', JSON.stringify(savedTxns));
        localStorage.setItem('settings', JSON.stringify({ ...emptySettings(), categories: SAMPLE_CATEGORIES }));

        // Run init
        init();

        // Verify transactions loaded
        expect(transactions.length).toBe(1);
        expect(transactions[0].description).toBe('Saved');
        expect(transactions[0].date).toBeInstanceOf(Date);

        // Verify DOM rendered
        const rows = transactionsBody.querySelectorAll('tr');
        expect(rows.length).toBe(1);
    });

    it('applies browser-restored date range dropdown on init', () => {
        // Simulate browser restoring dropdown to "last-month" after refresh
        dateRangeSelect.value = 'last-month';

        // Pre-populate with a transaction from 2 years ago (outside last-month range)
        const oldDate = new Date(2023, 0, 15);
        const savedTxns = [
            { date: oldDate.toISOString(), description: 'Old', amount: 10, type: 'expense', category: 'Casa', account: 'Amex' }
        ];
        localStorage.setItem('transactions', JSON.stringify(savedTxns));
        localStorage.setItem('settings', JSON.stringify({ ...emptySettings(), categories: SAMPLE_CATEGORIES }));

        init();

        // The old transaction should be filtered out by the "last-month" range
        expect(currentFilter.dateRange).toBe('last-month');
        expect(currentFilter.startDate).not.toBeNull();
        const rows = transactionsBody.querySelectorAll('tr');
        expect(rows.length).toBe(0);
    });

    it('re-renders the Balance Sheet when its tab opens', () => {
        // Arrange
        localStorage.setItem('settings', JSON.stringify({ ...emptySettings(), assets: [{ id: 'a', name: 'Savings', currency: 'CAD', archived: false }] }));
        init();

        // Act
        document.getElementById('tab-balance-sheet').click();

        // Assert
        expect(document.getElementById('bs-grid').textContent).toContain('Savings');
    });

    it('lists a category added in Settings once Transactions is opened', () => {
        // Arrange
        init();
        document.getElementById('tab-settings').click();
        document.getElementById('settings-new-category').value = 'Pets';
        document.getElementById('add-category-btn').click();

        // Act
        document.getElementById('tab-transactions').click();

        // Assert
        expect(Array.from(document.getElementById('category-select').options).map(o => o.value)).toContain('Pets');
    });

    it('leaves the hidden Transactions table alone while Settings change, and redraws it when it is opened', () => {
        // Arrange
        localStorage.setItem('transactions', JSON.stringify([
            { date: new Date(2025, 3, 12).toISOString(), description: 'Saved', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }
        ]));
        localStorage.setItem('settings', JSON.stringify({ ...emptySettings(), categories: SAMPLE_CATEGORIES }));
        init();
        const rowBefore = transactionsBody.querySelector('tr');
        document.getElementById('tab-settings').click();

        // Act
        document.getElementById('settings-new-category').value = 'Pets';
        document.getElementById('add-category-btn').click();
        const untouched = transactionsBody.querySelector('tr') === rowBefore;
        document.getElementById('tab-transactions').click();

        // Assert
        expect(untouched).toBe(true);
        expect(transactionsBody.querySelector('tr')).not.toBe(rowBefore);
        expect(transactionsBody.querySelectorAll('tr')).toHaveLength(1);
    });

    it('does not redraw the Transactions table after a Settings change it does not show', () => {
        // Arrange
        localStorage.setItem('transactions', JSON.stringify([
            { date: new Date(2025, 3, 12).toISOString(), description: 'Saved', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }
        ]));
        localStorage.setItem('settings', JSON.stringify({ ...emptySettings(), categories: SAMPLE_CATEGORIES }));
        init();
        const rowBefore = transactionsBody.querySelector('tr');
        document.getElementById('tab-settings').click();
        const swr = document.querySelector('[data-fire="swr"]');
        swr.value = '3.5';
        swr.dispatchEvent(new Event('change', { bubbles: true }));

        // Act
        document.getElementById('tab-transactions').click();

        // Assert
        expect(transactionsBody.querySelector('tr')).toBe(rowBefore);
    });

    it('shows restored transactions once Transactions is opened after a restore', async () => {
        // Arrange
        const { buildBackup } = await import('../js/backup.js');
        const { restoreModal, restoreFileInput } = await import('../js/dom.js');
        init();
        const settingsAfter = { ...emptySettings(), categories: SAMPLE_CATEGORIES };
        const file = JSON.stringify(buildBackup({
            settings: settingsAfter,
            transactions: [{ date: new Date(2025, 3, 12), description: 'Restored', amount: 7, type: 'expense', category: 'Casa', account: 'Amex' }],
            balances: {}, closedMonths: [], registeredRoom: []
        }, new Date()));
        document.getElementById('tab-settings').click();
        Object.defineProperty(restoreFileInput, 'files', { value: [new File([file], 'b.json')], configurable: true });
        restoreFileInput.dispatchEvent(new Event('change'));
        await vi.waitFor(() => expect(restoreModal.style.display).toBe('block'));
        document.getElementById('restore-confirm-btn').click();

        // Act
        document.getElementById('tab-transactions').click();

        // Assert
        expect(Array.from(transactionsBody.querySelectorAll('tr')).map(tr => tr.textContent)).toEqual([expect.stringContaining('Restored')]);
        expect(document.getElementById('total-expenses').textContent).toContain('7.00');
    });

    it('does not redraw the Transactions table when it is opened with nothing changed', () => {
        // Arrange
        localStorage.setItem('transactions', JSON.stringify([
            { date: new Date(2025, 3, 12).toISOString(), description: 'Saved', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }
        ]));
        localStorage.setItem('settings', JSON.stringify({ ...emptySettings(), categories: SAMPLE_CATEGORIES }));
        init();
        const rowBefore = transactionsBody.querySelector('tr');

        // Act
        document.getElementById('tab-settings').click();
        document.getElementById('tab-transactions').click();

        // Assert
        expect(transactionsBody.querySelector('tr')).toBe(rowBefore);
    });

    it('defaults to date ascending sort', () => {
        expect(currentSort.field).toBe('date');
        expect(currentSort.direction).toBe('asc');
    });
});

describe('Integration: app data always passes backup validation', () => {
    it('stays restorable after a fresh-install import and a manual transaction', async () => {
        // Arrange
        const { replaceAll, settings: liveSettings, balances, closedMonths, registeredRoom } = await import('../js/state.js');
        const { buildBackup, validateBackup } = await import('../js/backup.js');
        const { populateTransactionCategorySelect } = await import('../js/categories.js');
        const { handleAddTransaction } = await import('../js/transactions.js');
        const dom = await import('../js/dom.js');
        replaceAll({ transactions: [], settings: emptySettings(), balances: {}, closedMonths: [] });
        const { processFiles } = await import('../js/import-export.js');
        const files = {
            'td.csv': '12/02/2025,STARBUCKS COFFEE,12.50,,1000.00',
            'ft.csv': 'Date,Description,Category,Account,Amount,Type\n2025-02-03,Gift,presentes,TD,20,expense\n2025-02-04,Gift 2,Presentes,TD,5,expense'
        };
        dom.fileTypeSelect.value = 'auto';
        await processFiles([{ name: 'td.csv' }, { name: 'ft.csv' }], async file => files[file.name]);
        populateTransactionCategorySelect();
        dom.transactionDateInput.value = '2025-02-05';
        dom.transactionDescriptionInput.value = 'Manual';
        dom.transactionAmountInput.value = '3';
        dom.transactionCategorySelect.value = '';

        // Act
        handleAddTransaction(new Event('submit', { cancelable: true }));
        const backup = JSON.parse(JSON.stringify(buildBackup({ settings: liveSettings, transactions, balances, closedMonths, registeredRoom }, new Date())));

        // Assert
        expect(transactions.map(t => t.category)).toEqual(['Sem Categoria', 'presentes', 'presentes', 'Sem Categoria']);
        expect(validateBackup(backup).errors).toEqual([]);
    });
});
