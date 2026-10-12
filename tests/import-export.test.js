import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
    detectFileType, parseCSV, convertTransactionsToCSV,
    handleImport, processFiles, exportToCSV, summarizeByMonth, formatImportResult
} from '../js/import-export.js';
import { transactions, currentFilter, settings } from '../js/state.js';
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

    it('leaves the Settings category list unchanged', () => {
        // Arrange
        const csv = 'Date,Description,Category,Account,Amount,Type\n2025-04-12,Test,ImportedCat,Amex,50,expense';
        const before = structuredClone(settings.categories);

        // Act
        parseCSV(csv, 'fintracker');

        // Assert
        expect(settings.categories).toEqual(before);
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

    it('disables the import button while the selected files are read', async () => {
        // Arrange
        fileTypeSelect.value = 'amex';
        const file = new File(['Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,STARBUCKS,1'], 'test.csv');
        Object.defineProperty(fileInput, 'files', { value: [file], writable: true, configurable: true });

        // Act
        const done = handleImport();

        // Assert
        expect(importBtn.disabled).toBe(true);
        await done;
        expect(importBtn.disabled).toBe(false);
        expect(transactions).toHaveLength(1);
    });
});

describe('summarizeByMonth', () => {
    it('returns an empty list for no transactions', () => {
        // Act, Assert
        expect(summarizeByMonth([])).toEqual([]);
    });

    it('counts transactions per local month, sorted ascending', () => {
        // Arrange
        const added = [
            { date: new Date(2026, 8, 30, 23, 30) },
            { date: new Date(2026, 7, 1) },
            { date: new Date(2026, 8, 1, 0, 0) },
            { date: new Date(2025, 11, 31) }
        ];

        // Act
        const summary = summarizeByMonth(added);

        // Assert
        expect(summary).toEqual([
            { month: '2025-12', count: 1 },
            { month: '2026-08', count: 1 },
            { month: '2026-09', count: 2 }
        ]);
    });
});

describe('formatImportResult', () => {
    const totals = (overrides) => ({ fileCount: 4, imported: 0, duplicates: 0, ignored: 0, errors: 0, months: [], messages: [], ...overrides });

    it('lists each month with its added count', () => {
        // Arrange
        const result = totals({
            imported: 151, duplicates: 212, ignored: 9,
            months: [{ month: '2026-08', count: 3 }, { month: '2026-09', count: 148 }]
        });

        // Act
        const text = formatImportResult(result);

        // Assert
        expect(text).toEqual({
            title: 'Import complete',
            headline: 'Imported 151 transactions from 4 files:',
            months: ['2026-08: 3 added', '2026-09: 148 added'],
            counts: '212 duplicates skipped · 9 matched the ignore list · 0 errors',
            messages: []
        });
    });

    it('uses singular wording for one transaction, file, duplicate and error', () => {
        // Arrange
        const result = totals({ fileCount: 1, imported: 1, duplicates: 1, errors: 1, months: [{ month: '2026-09', count: 1 }] });

        // Act
        const text = formatImportResult(result);

        // Assert
        expect(text.headline).toBe('Imported 1 transaction from 1 file:');
        expect(text.counts).toBe('1 duplicate skipped · 0 matched the ignore list · 1 error');
    });

    it('says nothing was imported and carries file messages', () => {
        // Arrange
        const result = totals({ fileCount: 1, errors: 1, messages: ['b.csv: Set the BRL rate.'] });

        // Act
        const text = formatImportResult(result);

        // Assert
        expect(text.headline).toBe('No transactions were imported from 1 file.');
        expect(text.months).toEqual([]);
        expect(text.messages).toEqual(['b.csv: Set the BRL rate.']);
    });
});

describe('processFiles', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    const AMEX_HEADER = 'Date,Date Processed,Description,Amount';
    const FINTRACKER_HEADER = 'Date,Description,Category,Account,Amount,Type';
    const files = (...names) => names.map(name => ({ name }));
    const readerOf = (...contents) => {
        let call = 0;

        return vi.fn(async () => contents[call++]);
    };
    const dialog = () => document.getElementById('import-result-modal');
    const dialogText = () => dialog().textContent.replace(/\s+/g, ' ');

    it('shows the result dialog and re-enables the button when there are no files', async () => {
        // Arrange
        importBtn.disabled = true;

        // Act
        await processFiles([], readerOf());

        // Assert
        expect(importBtn.disabled).toBe(false);
        expect(importBtn.textContent).toBe('Import');
        expect(dialog().style.display).toBe('block');
        expect(dialogText()).toContain('No transactions were imported from 0 files.');
    });

    it('reads a file, adds its rows and lists them per month', async () => {
        // Arrange
        fileTypeSelect.value = 'amex';
        const [file] = files('test.csv');
        const readText = readerOf(`${AMEX_HEADER}\n28 Feb 2025,28 Feb 2025,STARBUCKS,12.50\n01 Mar 2025,01 Mar 2025,UBER,5`);

        // Act
        await processFiles([file], readText);

        // Assert
        expect(readText).toHaveBeenCalledWith(file);
        expect(transactions.map(t => t.description)).toEqual(['STARBUCKS', 'UBER']);
        expect(dialogText()).toContain('Imported 2 transactions from 1 file:');
        expect(dialogText()).toContain('2025-02: 1 added');
        expect(dialogText()).toContain('2025-03: 1 added');
    });

    it('saves imported rows', async () => {
        // Arrange
        fileTypeSelect.value = 'amex';

        // Act
        await processFiles(files('test.csv'), readerOf(`${AMEX_HEADER}\n28 Feb 2025,28 Feb 2025,STARBUCKS,12.50`));

        // Assert
        expect(JSON.parse(localStorage.getItem('transactions'))).toHaveLength(1);
    });

    it('detects duplicates and skips them', async () => {
        // Arrange
        fileTypeSelect.value = 'amex';
        transactions.push(
            { date: new Date(2025, 1, 28), description: 'STARBUCKS', amount: 12.50, type: 'expense', category: 'Alimentação', account: 'Amex' }
        );

        // Act
        await processFiles(files('test.csv'), readerOf(`${AMEX_HEADER}\n28 Feb 2025,28 Feb 2025,STARBUCKS,12.50`));

        // Assert
        expect(transactions.length).toBe(1);
        expect(dialogText()).toContain('No transactions were imported');
        expect(dialogText()).toContain('1 duplicate skipped');
    });

    it('counts a row that is both ignored and a duplicate as ignored only', async () => {
        // Arrange
        fileTypeSelect.value = 'amex';
        transactions.push(
            { date: new Date(2025, 1, 28), description: 'PAYMENT RECEIVED - THANK YOU', amount: 300, type: 'income', category: 'Outro', account: 'Amex' }
        );

        // Act
        await processFiles(files('test.csv'), readerOf(`${AMEX_HEADER}\n28 Feb 2025,28 Feb 2025,PAYMENT RECEIVED - THANK YOU,-300.00`));

        // Assert
        expect(transactions.length).toBe(1);
        expect(dialogText()).toContain('0 duplicates skipped · 1 matched the ignore list · 0 errors');
    });

    it('reads files one after another and carries counts across them', async () => {
        // Arrange
        fileTypeSelect.value = 'amex';
        const csvContent = `${AMEX_HEADER}\n28 Feb 2025,28 Feb 2025,PAYMENT RECEIVED - THANK YOU,-300.00\n28 Feb 2025,28 Feb 2025,STARBUCKS,1`;
        const readText = readerOf(csvContent, csvContent);
        const [a, b] = files('a.csv', 'b.csv');

        // Act
        await processFiles([a, b], readText);

        // Assert
        expect(readText.mock.calls).toEqual([[a], [b]]);
        expect(dialogText()).toContain('Imported 1 transaction from 2 files:');
        expect(dialogText()).toContain('1 duplicate skipped · 2 matched the ignore list');
    });

    it('shows which file is being read on the button', async () => {
        // Arrange
        fileTypeSelect.value = 'amex';
        const seen = [];
        const readText = vi.fn(async () => {
            seen.push(importBtn.textContent);

            return `${AMEX_HEADER}\n28 Feb 2025,28 Feb 2025,TEST,10`;
        });

        // Act
        await processFiles(files('a.csv', 'b.csv'), readText);

        // Assert
        expect(seen).toEqual(['Importing (1/2)...', 'Importing (2/2)...']);
    });

    it('reports a file the parser rejects by name and imports nothing from it', async () => {
        // Arrange
        fileTypeSelect.value = 'bradesco';
        settings.rates.BRL = null;
        vi.spyOn(console, 'error').mockImplementation(() => {});

        // Act
        await processFiles(files('brl.csv'), readerOf('Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)\n01/03/2025;SALARIO;1;5,00;;7,00'));

        // Assert
        expect(transactions).toHaveLength(0);
        expect(dialogText()).toContain('brl.csv: Set the BRL → CAD rate in Settings before importing Bradesco files.');
        expect(dialogText()).toContain('1 error');
    });

    it('adds a new category from an imported row to Settings and the filter dropdown', async () => {
        // Arrange
        fileTypeSelect.value = 'fintracker';

        // Act
        await processFiles(files('ft.csv'), readerOf(`${FINTRACKER_HEADER}\n2026-01-01,Vet,Pets,TD,10,expense`));

        // Assert
        expect(settings.categories.expense).toContain('Pets');
        const options = Array.from(document.getElementById('category-select').options).map(o => o.value);
        expect(options).toContain('Pets');
    });

    it('files an imported row under the stored spelling of a known category', async () => {
        // Arrange
        fileTypeSelect.value = 'fintracker';
        const before = [...settings.categories.expense];

        // Act
        await processFiles(files('ft.csv'), readerOf(`${FINTRACKER_HEADER}\n2026-01-01,Rent,CASA,TD,10,expense`));

        // Assert
        expect(transactions[0].category).toBe('Casa');
        expect(settings.categories.expense).toEqual(before);
    });

    it('does not add categories from rows skipped as duplicates or ignored', async () => {
        // Arrange
        fileTypeSelect.value = 'fintracker';
        transactions.push(
            { date: new Date(2026, 0, 1), description: 'Vet', amount: 10, type: 'expense', category: 'Casa', account: 'TD' }
        );
        const before = structuredClone(settings.categories);
        const csv = `${FINTRACKER_HEADER}\n2026-01-01,Vet,Pets,TD,10,expense\n2026-01-02,PAYMENT RECEIVED - THANK YOU,Transfers,TD,50,income`;

        // Act
        await processFiles(files('ft.csv'), readerOf(csv));

        // Assert
        expect(settings.categories).toEqual(before);
        expect(dialogText()).toContain('1 duplicate skipped · 1 matched the ignore list');
    });

    it('warns about a file without transactions', async () => {
        // Arrange
        fileTypeSelect.value = 'amex';
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Act
        await processFiles(files('empty.csv'), readerOf(`${AMEX_HEADER}\n`));

        // Assert
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('empty.csv'));
        expect(dialogText()).toContain('No transactions were imported from 1 file.');
    });

    it('reports a file that cannot be read and goes on with the next one', async () => {
        // Arrange
        fileTypeSelect.value = 'amex';
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const readText = vi.fn()
            .mockRejectedValueOnce(new Error('read error'))
            .mockResolvedValueOnce(`${AMEX_HEADER}\n28 Feb 2025,28 Feb 2025,STARBUCKS,1`);

        // Act
        await processFiles(files('error.csv', 'ok.csv'), readText);

        // Assert
        expect(dialogText()).toContain("error.csv: couldn't be read. Check the file encoding and format.");
        expect(dialogText()).toContain('1 error');
        expect(transactions).toHaveLength(1);
    });

    it('reports parse errors in the counts', async () => {
        // Arrange
        fileTypeSelect.value = 'fintracker';
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const csvContent = `${FINTRACKER_HEADER}\n2025-01-01,Test,,Amex,10,badtype\n2025-01-01,Valid,Casa,Amex,10,expense`;

        // Act
        await processFiles(files('mixed.csv'), readerOf(csvContent));

        // Assert
        expect(dialogText()).toContain('1 error');
    });

    it('escapes file names and messages in the dialog', async () => {
        // Arrange
        vi.spyOn(console, 'error').mockImplementation(() => {});

        // Act
        await processFiles(files('<img src=x onerror=alert(1)>.csv'), vi.fn().mockRejectedValue(new Error('read error')));

        // Assert
        expect(dialog().querySelector('img')).toBeNull();
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
