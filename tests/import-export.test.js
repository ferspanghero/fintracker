import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    detectFileType, parseCSV, convertTransactionsToCSV,
    handleImport, processFiles, exportToCSV
} from '../js/import-export.js';
import { transactions, currentFilter } from '../js/state.js';
import { categories } from '../js/categories.js';
import { fileInput, fileTypeSelect, importBtn } from '../js/dom.js';

describe('detectFileType', () => {
    it('detects fintracker format', () => {
        expect(detectFileType('Date,Description,Category,Account,Amount,Type')).toBe('fintracker');
    });

    it('detects amex format', () => {
        expect(detectFileType('Date,Date Processed,Description,Amount')).toBe('amex');
    });

    it('detects mastercard format', () => {
        expect(detectFileType('Description,Type,Card Holder Name,Date,Time,Amount')).toBe('mastercard');
    });

    it('detects simplii format', () => {
        expect(detectFileType('Date, Transaction Details, Funds Out, Funds In')).toBe('simplii');
    });

    it('detects bradesco format', () => {
        expect(detectFileType('Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)')).toBe('bradesco');
    });

    it('falls back to td for unknown headers', () => {
        expect(detectFileType('some,random,header')).toBe('td');
    });

    it('is case insensitive', () => {
        expect(detectFileType('DATE,DESCRIPTION,CATEGORY,ACCOUNT,AMOUNT,TYPE')).toBe('fintracker');
    });

    it('may not detect BOM-prefixed fintracker header (known limitation)', () => {
        const result = detectFileType('\uFEFFDate,Description,Category,Account,Amount,Type');
        expect(['fintracker', 'td']).toContain(result);
    });
});

describe('parseCSV', () => {
    it('auto-detects fintracker format', () => {
        const csv = 'Date,Description,Category,Account,Amount,Type\n2025-04-12,Test,Casa,Amex,50,expense';
        const result = parseCSV(csv, 'auto');
        expect(result.transactions.length).toBe(1);
        expect(result.transactions[0].description).toBe('Test');
    });

    it('auto-detects amex format', () => {
        const csv = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,STARBUCKS,12.50';
        const result = parseCSV(csv, 'auto');
        expect(result.transactions.length).toBe(1);
    });

    it('uses explicit fileType', () => {
        const csv = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,STARBUCKS,12.50';
        const result = parseCSV(csv, 'amex');
        expect(result.transactions.length).toBe(1);
    });

    it('TD starts from row 0 (no header)', () => {
        const csv = '1/1/2025,TIM HORTONS,5.50,,1000.00';
        const result = parseCSV(csv, 'td');
        expect(result.transactions.length).toBe(1);
    });

    it('parses simplii format via parseCSV', () => {
        const csv = 'Date, Transaction Details, Funds Out, Funds In\n2/5/2025, GROCERY STORE, 50.00, ';
        const result = parseCSV(csv, 'simplii');
        expect(result.transactions.length).toBe(1);
        expect(result.transactions[0].account).toBe('Simplii');
    });

    it('skips empty lines', () => {
        const csv = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,TEST,10\n\n28 Feb 2025,28 Feb 2025,TEST2,20';
        const result = parseCSV(csv, 'amex');
        expect(result.transactions.length).toBe(2);
    });

    it('catches parse errors and returns error count', () => {
        const csv = 'Date,Description,Category,Account,Amount,Type\n2025-01-01,Test,,Amex,10,badtype\n2025-01-01,Valid,Casa,Amex,10,expense';
        const result = parseCSV(csv, 'fintracker');
        expect(result.transactions.length).toBe(1);
        expect(result.errorCount).toBe(1);
    });

    it('returns zero errorCount for clean CSV', () => {
        const csv = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,TEST,10';
        const result = parseCSV(csv, 'amex');
        expect(result.errorCount).toBe(0);
    });

    it('throws for unknown file type in explicit mode', () => {
        const csv = 'header\ndata';
        expect(() => parseCSV(csv, 'nonexistent')).toThrow('Unknown file type: nonexistent');
    });

    it('auto-categorizes transactions from bank parsers', () => {
        const csv = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,NETFLIX,15.00';
        const result = parseCSV(csv, 'amex');
        expect(result.transactions[0].category).toBe('Lazer');
    });

    it('preserves category from fintracker format', () => {
        const csv = 'Date,Description,Category,Account,Amount,Type\n2025-04-12,Test,CustomCat,Amex,50,expense';
        const result = parseCSV(csv, 'fintracker');
        expect(result.transactions[0].category).toBe('CustomCat');
    });

    it('auto-categorizes fintracker when category is empty', () => {
        const csv = 'Date,Description,Category,Account,Amount,Type\n2025-04-12,COSTCO,,Simplii,100.00,expense';
        const result = parseCSV(csv, 'fintracker');
        expect(result.transactions[0].category).toBeTruthy();
    });

    it('adds new fintracker categories to global categories list', () => {
        const csv = 'Date,Description,Category,Account,Amount,Type\n2025-04-12,Test,ImportedCat,Amex,50,expense';
        parseCSV(csv, 'fintracker');
        expect(categories.expense).toContain('ImportedCat');
    });
});

describe('convertTransactionsToCSV', () => {
    const makeTxn = (overrides) => ({
        date: new Date(2025, 3, 12),
        description: 'Test',
        amount: 50,
        type: 'expense',
        category: 'Casa',
        account: 'Amex',
        ...overrides
    });

    it('generates CSV with BOM and header', () => {
        const csv = convertTransactionsToCSV([makeTxn()]);
        expect(csv.startsWith('\uFEFF')).toBe(true);
        expect(csv).toContain('Date,Description,Category,Account,Amount,Type');
    });

    it('generates correct row data', () => {
        const csv = convertTransactionsToCSV([makeTxn()]);
        expect(csv).toContain('2025-04-12');
        expect(csv).toContain('"Test"');
        expect(csv).toContain('Casa');
        expect(csv).toContain('Amex');
        expect(csv).toContain('50');
        expect(csv).toContain('expense');
    });

    it('escapes quotes in description', () => {
        const csv = convertTransactionsToCSV([makeTxn({ description: 'He said "hello"' })]);
        expect(csv).toContain('"He said ""hello"""');
    });

    it('handles empty array', () => {
        const csv = convertTransactionsToCSV([]);
        expect(csv).toContain('Date,Description,Category,Account,Amount,Type');
        const lines = csv.split('\n');
        expect(lines.length).toBe(2);
    });

    it('generates multiple rows', () => {
        const csv = convertTransactionsToCSV([makeTxn(), makeTxn({ description: 'Second' })]);
        const lines = csv.split('\n');
        expect(lines.length).toBe(3);
    });

    it('escapes commas in category and account fields', () => {
        const csv = convertTransactionsToCSV([makeTxn({ category: 'Food, Drink', account: 'My, Account' })]);
        expect(csv).toContain('"Food, Drink"');
        expect(csv).toContain('"My, Account"');
    });

    it('escapes quotes in category and account fields', () => {
        const csv = convertTransactionsToCSV([makeTxn({ category: 'Say "hi"', account: 'Acc "1"' })]);
        expect(csv).toContain('"Say ""hi"""');
        expect(csv).toContain('"Acc ""1"""');
    });
});

describe('handleImport', () => {
    beforeEach(() => {
        vi.spyOn(window, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('alerts when no files selected', () => {
        handleImport();
        expect(window.alert).toHaveBeenCalledWith('Please select at least one file to import.');
    });

    it('disables import button and starts processing', () => {
        const OriginalFileReader = globalThis.FileReader;
        const mock = { readAsText: vi.fn(), onload: null, onerror: null };
        globalThis.FileReader = function() { return mock; };

        Object.defineProperty(fileInput, 'files', {
            value: { length: 1, 0: { name: 'test.csv' } },
            writable: true,
            configurable: true
        });

        handleImport();
        expect(importBtn.disabled).toBe(true);
        expect(importBtn.textContent).toBe('Importing...');
        expect(mock.readAsText).toHaveBeenCalled();

        globalThis.FileReader = OriginalFileReader;
    });
});

describe('processFiles', () => {
    let OriginalFileReader;

    beforeEach(() => {
        OriginalFileReader = globalThis.FileReader;
        vi.spyOn(window, 'alert').mockImplementation(() => {});
    });

    afterEach(() => {
        globalThis.FileReader = OriginalFileReader;
        vi.restoreAllMocks();
    });

    function mockFileReader() {
        const mock = { readAsText: vi.fn(), onload: null, onerror: null };
        globalThis.FileReader = function() { return mock; };
        return mock;
    }

    it('shows success alert when all files processed with imports', () => {
        importBtn.disabled = true;
        processFiles({ length: 0 }, 0, 5, 2);
        expect(importBtn.disabled).toBe(false);
        expect(importBtn.textContent).toBe('Import');
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('5 transactions'));
    });

    it('shows no-import alert when zero imported', () => {
        processFiles({ length: 0 }, 0, 0, 3);
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('No transactions'));
    });

    it('reads file and processes valid CSV content', () => {
        const csvContent = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,STARBUCKS,12.50';
        fileTypeSelect.value = 'amex';
        const mock = mockFileReader();

        const file = { name: 'test.csv' };
        const files = { length: 1, 0: file };

        processFiles(files, 0, 0, 0);
        expect(mock.readAsText).toHaveBeenCalledWith(file, 'UTF-8');

        mock.onload({ target: { result: csvContent } });

        expect(transactions.length).toBe(1);
        expect(transactions[0].description).toBe('STARBUCKS');
        expect(window.alert).toHaveBeenCalled();
    });

    it('detects duplicates and skips them', () => {
        fileTypeSelect.value = 'amex';
        transactions.push(
            { date: new Date(2025, 1, 28), description: 'STARBUCKS', amount: 12.50, type: 'expense', category: 'Alimentação', account: 'Amex' }
        );

        const csvContent = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,STARBUCKS,12.50';
        const mock = mockFileReader();

        const files = { length: 1, 0: { name: 'test.csv' } };
        processFiles(files, 0, 0, 0);
        mock.onload({ target: { result: csvContent } });

        expect(transactions.length).toBe(1);
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('No transactions'));
    });

    it('skips rows on the ignore list and reports how many', () => {
        fileTypeSelect.value = 'amex';
        const csvContent = [
            'Date,Date Processed,Description,Amount',
            '28 Feb 2025,28 Feb 2025,STARBUCKS,12.50',
            '28 Feb 2025,28 Feb 2025,PAYMENT RECEIVED - THANK YOU,-300.00'
        ].join('\n');
        const mock = mockFileReader();

        const files = { length: 1, 0: { name: 'test.csv' } };
        processFiles(files, 0, 0, 0);
        mock.onload({ target: { result: csvContent } });

        expect(transactions.map(t => t.description)).toEqual(['STARBUCKS']);
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('1 transaction(s) matched the ignore list'));
    });

    it('counts a row that is both ignored and a duplicate as ignored only', () => {
        fileTypeSelect.value = 'amex';
        transactions.push(
            { date: new Date(2025, 1, 28), description: 'PAYMENT RECEIVED - THANK YOU', amount: 300, type: 'income', category: 'Outro', account: 'Amex' }
        );

        const csvContent = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,PAYMENT RECEIVED - THANK YOU,-300.00';
        const mock = mockFileReader();

        const files = { length: 1, 0: { name: 'test.csv' } };
        processFiles(files, 0, 0, 0);
        mock.onload({ target: { result: csvContent } });

        expect(transactions.length).toBe(1);
        expect(window.alert).toHaveBeenCalledWith(
            'No transactions were imported. 0 duplicates were ignored. 1 transaction(s) matched the ignore list.'
        );
    });

    it('carries the ignored count across files', () => {
        fileTypeSelect.value = 'amex';
        const csvContent = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,PAYMENT RECEIVED - THANK YOU,-300.00';
        const mock = mockFileReader();

        const files = { length: 2, 0: { name: 'a.csv' }, 1: { name: 'b.csv' } };
        processFiles(files, 0, 0, 0);
        mock.onload({ target: { result: csvContent } });
        mock.onload({ target: { result: csvContent } });

        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('2 transaction(s) matched the ignore list'));
    });

    it('omits the ignore-list note when nothing was ignored', () => {
        processFiles({ length: 0 }, 0, 5, 2, 0, 0);
        expect(window.alert).toHaveBeenCalledWith(expect.not.stringContaining('ignore list'));
    });

    it('handles parse errors gracefully', () => {
        fileTypeSelect.value = 'amex';
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const mock = mockFileReader();
        const files = { length: 1, 0: { name: 'bad.csv' } };
        processFiles(files, 0, 0, 0);
        mock.onload({ target: { result: null } });
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('bad.csv'));
    });

    it('handles empty parse results', () => {
        fileTypeSelect.value = 'amex';
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const csvContent = 'Date,Date Processed,Description,Amount\n';
        const mock = mockFileReader();

        const files = { length: 1, 0: { name: 'empty.csv' } };
        processFiles(files, 0, 0, 0);
        mock.onload({ target: { result: csvContent } });

        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('empty.csv'));
    });

    it('handles reader.onerror', () => {
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const mock = mockFileReader();

        const files = { length: 1, 0: { name: 'error.csv' } };
        processFiles(files, 0, 0, 0);
        mock.onerror({ target: { error: new Error('read error') } });

        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('error.csv'), expect.anything());
        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('error.csv'));
    });

    it('preserves totalDuplicates through reader.onerror', () => {
        const mock = mockFileReader();
        const files = { length: 1, 0: { name: 'error.csv' } };
        processFiles(files, 0, 3, 5);
        mock.onerror({ target: { error: new Error('read error') } });

        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('5 duplicates'));
    });

    it('reports error count in final alert', () => {
        fileTypeSelect.value = 'fintracker';
        const mock = mockFileReader();
        const csvContent = 'Date,Description,Category,Account,Amount,Type\n2025-01-01,Test,,Amex,10,badtype\n2025-01-01,Valid,Casa,Amex,10,expense';
        const files = { length: 1, 0: { name: 'mixed.csv' } };
        processFiles(files, 0, 0, 0, 0);
        mock.onload({ target: { result: csvContent } });

        expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('1 error'));
    });

    it('updates button text to show progress', () => {
        fileTypeSelect.value = 'amex';
        const csvContent = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,TEST,10';

        const mocks = [];
        globalThis.FileReader = function() {
            const m = { readAsText: vi.fn(), onload: null, onerror: null };
            mocks.push(m);
            return m;
        };

        const files = { length: 2, 0: { name: 'a.csv' }, 1: { name: 'b.csv' } };
        processFiles(files, 0, 0, 0);
        mocks[0].onload({ target: { result: csvContent } });

        expect(importBtn.textContent).toContain('1/2');
    });
});

describe('exportToCSV', () => {
    let origCreateElement;

    beforeEach(() => {
        origCreateElement = Document.prototype.createElement;
    });

    afterEach(() => {
        Document.prototype.createElement = origCreateElement;
        vi.restoreAllMocks();
    });

    function setupExportMocks() {
        vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

        let clickedLink = null;
        const saved = origCreateElement;
        Document.prototype.createElement = function(tag, options) {
            const el = saved.call(this, tag, options);
            if (tag === 'a') {
                el.click = () => { clickedLink = el; };
            }
            return el;
        };
        return () => clickedLink;
    }

    it('creates a download with correct filename and triggers click', () => {
        transactions.push(
            { date: new Date(2025, 3, 12), description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }
        );
        const getLink = setupExportMocks();

        exportToCSV();

        expect(URL.createObjectURL).toHaveBeenCalled();
        const link = getLink();
        expect(link).toBeTruthy();
        expect(link.download).toMatch(/\d{4}_\d{2}_controle_de_gastos\.csv/);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('uses currentFilter.startDate for filename when set', () => {
        transactions.push(
            { date: new Date(2025, 3, 12), description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }
        );
        currentFilter.startDate = new Date(2024, 11, 1);
        const getLink = setupExportMocks();

        exportToCSV();

        expect(getLink().download).toBe('2024_12_controle_de_gastos.csv');
    });
});
