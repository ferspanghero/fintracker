import { describe, it, expect, vi } from 'vitest';

describe('Integration: CSV import and parsing', () => {
    it('imports Amex CSV and populates transactions', () => {
        const csv = [
            'Date,Date Processed,Description,Amount',
            '28 Feb 2025,28 Feb 2025,STARBUCKS COFFEE,12.50',
            '01 Mar 2025,01 Mar 2025,PAYMENT RECEIVED,-500.00',
            '05 Mar 2025,05 Mar 2025,UBER TRIP,25.00'
        ].join('\n');

        const result = parseCSV(csv, 'amex');
        expect(result.length).toBe(3);

        // Verify first transaction
        expect(result[0].description).toBe('STARBUCKS COFFEE');
        expect(result[0].type).toBe('expense');
        expect(result[0].amount).toBe(12.50);

        // Verify payment (income)
        expect(result[1].type).toBe('income');
        expect(result[1].amount).toBe(500);

        // Verify categories were assigned
        result.forEach(txn => {
            expect(txn.category).toBeTruthy();
        });
    });

    it('imports Mastercard CSV', () => {
        const csv = [
            'Description,Type,Card Holder Name,Date,Time,Amount',
            'COSTCO WHOLESALE,PURCHASE,JOHN DOE,2/15/2025,2:30 PM,150.00',
            'ONLINE PAYMENT,PAYMENT,JOHN DOE,2/20/2025,10:00 AM,500.00'
        ].join('\n');

        const result = parseCSV(csv, 'mastercard');
        expect(result.length).toBe(2);
        expect(result[0].type).toBe('expense');
        expect(result[0].description).toContain('JOHN DOE');
        expect(result[1].type).toBe('income');
    });

    it('imports TD CSV (no header)', () => {
        const csv = [
            '2/18/2025,TIM HORTONS,5.50,,5274.51',
            '2/19/2025,DIRECT DEPOSIT,,2000.00,7274.51'
        ].join('\n');

        const result = parseCSV(csv, 'td');
        expect(result.length).toBe(2);
        expect(result[0].type).toBe('expense');
        expect(result[1].type).toBe('income');
    });

    it('imports Bradesco CSV with semicolons and BRL conversion', () => {
        const csv = [
            'Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)',
            '28/02/2025;SALDO ANTERIOR;0;0,00; ;2.279,37',
            '01/03/2025;SALARIO;12345;5.000,00;;7.279,37',
            '02/03/2025;MERCADO PAG;67890;;200,00;7.079,37'
        ].join('\n');

        const result = parseCSV(csv, 'bradesco');
        // SALDO ANTERIOR has 0 credit and space for debit, should be skipped
        expect(result.length).toBe(2);
        expect(result[0].type).toBe('income');
        expect(result[0].amount).toBeCloseTo(BRLtoCAD(5000));
        expect(result[1].type).toBe('expense');
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

        expect(reimported.length).toBe(2);

        // Verify data matches
        expect(reimported[0].description).toBe('Coffee Shop');
        expect(reimported[0].amount).toBe(5.50);
        expect(reimported[0].type).toBe('expense');
        expect(reimported[0].category).toBe('Alimentação');
        expect(reimported[0].account).toBe('Amex');

        expect(reimported[1].description).toBe('Salary');
        expect(reimported[1].amount).toBe(3000);
        expect(reimported[1].type).toBe('income');
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
        transactions = [
            { date: new Date(2025, 3, 12), description: 'Existing', amount: 50, type: 'expense', account: 'Amex' }
        ];
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

        transactions = parseCSV(csv, 'amex');
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

        transactions = parseCSV(csv, 'amex');
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
        localStorage.setItem('categories', JSON.stringify(defaultCategories));

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
});
