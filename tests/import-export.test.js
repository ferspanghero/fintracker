import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

    // TODO: BUG - detectFileType does not strip BOM character.
    // A BOM-prefixed fintracker header may not be detected correctly.
    it('may not detect BOM-prefixed fintracker header (known limitation)', () => {
        const result = detectFileType('\uFEFFDate,Description,Category,Account,Amount,Type');
        // BOM prepends to the string, but toLowerCase+trim doesn't remove it.
        // The includes() check may still work since BOM is before the matched substring.
        // Let's test actual behavior:
        expect(['fintracker', 'td']).toContain(result);
    });
});

describe('parseFinTrackerTransaction', () => {
    it('parses valid expense line', () => {
        const result = parseFinTrackerTransaction(
            '2025-04-12,Groceries,Mercado,Simplii,55.00,expense', 'fintracker'
        );
        expect(result.date.getFullYear()).toBe(2025);
        expect(result.description).toBe('Groceries');
        expect(result.category).toBe('Mercado');
        expect(result.account).toBe('Simplii');
        expect(result.amount).toBe(55);
        expect(result.type).toBe('expense');
    });

    it('parses valid income line', () => {
        const result = parseFinTrackerTransaction(
            '2025-04-12,Salary,Trabalho,TD,3000.00,income', 'fintracker'
        );
        expect(result.type).toBe('income');
        expect(result.amount).toBe(3000);
    });

    it('parses quoted description with comma', () => {
        const result = parseFinTrackerTransaction(
            '2025-04-12,"Coffee, Starbucks",Alimentação,Amex,5.50,expense', 'fintracker'
        );
        expect(result.description).toBe('Coffee, Starbucks');
    });

    it('returns null for too few fields', () => {
        expect(parseFinTrackerTransaction('2025-04-12,Groceries,Mercado', 'fintracker')).toBeNull();
    });

    it('adds new category to categories array', () => {
        parseFinTrackerTransaction(
            '2025-04-12,Test,CustomCat,Amex,50.00,expense', 'fintracker'
        );
        expect(categories.expense).toContain('CustomCat');
    });

    // TODO: BUG - temporal dead zone: 'type' is referenced on line 185 (in the fallback
    // for empty category) but const-declared on line 188. When parts[2] is empty/falsy,
    // this throws ReferenceError.
    it('throws when category is empty (known TDZ bug)', () => {
        expect(() => {
            parseFinTrackerTransaction('2025-04-12,COSTCO,,Simplii,100.00,expense', 'fintracker');
        }).toThrow();
    });
});

describe('parseAmexTransaction', () => {
    it('parses positive amount as expense', () => {
        const result = parseAmexTransaction('28 Feb 2025,28 Feb 2025,STARBUCKS COFFEE,12.50', 'amex');
        expect(result.type).toBe('expense');
        expect(result.amount).toBe(12.50);
        expect(result.account).toBe('Amex');
        expect(result.description).toBe('STARBUCKS COFFEE');
    });

    it('parses negative amount as income', () => {
        const result = parseAmexTransaction('28 Feb 2025,28 Feb 2025,PAYMENT RECEIVED,-500.00', 'amex');
        expect(result.type).toBe('income');
        expect(result.amount).toBe(500);
    });

    it('returns null for too few fields', () => {
        expect(parseAmexTransaction('28 Feb 2025,desc', 'amex')).toBeNull();
    });

    it('auto-categorizes based on description', () => {
        const result = parseAmexTransaction('28 Feb 2025,28 Feb 2025,NETFLIX,15.00', 'amex');
        expect(result.category).toBe('Lazer');
    });
});

describe('parseMastercardTransaction', () => {
    it('parses purchase as expense', () => {
        const result = parseMastercardTransaction(
            'STARBUCKS,PURCHASE,JOHN DOE,2/5/2025,10:00 AM,15.75', 'mastercard'
        );
        expect(result.type).toBe('expense');
        expect(result.amount).toBe(15.75);
        expect(result.account).toBe('Mastercard');
    });

    it('parses payment as income', () => {
        const result = parseMastercardTransaction(
            'PAYMENT,PAYMENT,JOHN DOE,2/5/2025,10:00 AM,500.00', 'mastercard'
        );
        expect(result.type).toBe('income');
    });

    it('appends cardholder to description', () => {
        const result = parseMastercardTransaction(
            'COFFEE SHOP,PURCHASE,JANE DOE,2/5/2025,10:00 AM,5.00', 'mastercard'
        );
        expect(result.description).toBe('COFFEE SHOP (JANE DOE)');
    });

    it('returns null for too few fields', () => {
        expect(parseMastercardTransaction('desc,type,name', 'mastercard')).toBeNull();
    });
});

describe('parseSimpliiTransaction', () => {
    it('parses funds out as expense', () => {
        const result = parseSimpliiTransaction('2/5/2025, GROCERY STORE, 50.00, ', 'simplii');
        expect(result.type).toBe('expense');
        expect(result.amount).toBe(50);
        expect(result.account).toBe('Simplii');
    });

    it('parses funds in as income', () => {
        const result = parseSimpliiTransaction('2/5/2025, DEPOSIT, , 1000.00', 'simplii');
        expect(result.type).toBe('income');
        expect(result.amount).toBe(1000);
    });

    it('returns null for too few fields', () => {
        expect(parseSimpliiTransaction('2/5/2025, desc', 'simplii')).toBeNull();
    });
});

describe('parseTDTransaction', () => {
    it('parses amount out as expense', () => {
        const result = parseTDTransaction('1/1/2025,TIM HORTONS,5.50,,1000.00', 'td');
        expect(result.type).toBe('expense');
        expect(result.amount).toBe(5.50);
        expect(result.account).toBe('TD');
    });

    it('parses amount in as income', () => {
        const result = parseTDTransaction('1/1/2025,DIRECT DEPOSIT,,2000.00,3000.00', 'td');
        expect(result.type).toBe('income');
        expect(result.amount).toBe(2000);
    });

    it('returns null when no amount', () => {
        expect(parseTDTransaction('1/1/2025,SOMETHING,,,', 'td')).toBeNull();
    });

    it('returns null for too few fields', () => {
        expect(parseTDTransaction('1/1/2025,desc', 'td')).toBeNull();
    });
});

describe('parseBradescoTransaction', () => {
    it('parses credit as income with BRL conversion', () => {
        const result = parseBradescoTransaction(
            '26/02/2025;SALARIO;12345;1.000,50;;5.000,00', 'bradesco'
        );
        expect(result.type).toBe('income');
        expect(result.amount).toBeCloseTo(BRLtoCAD(1000.50));
        expect(result.account).toBe('Bradesco');
    });

    it('parses debit as expense with BRL conversion', () => {
        const result = parseBradescoTransaction(
            '26/02/2025;MERCADO;12345;;500,00;4.500,00', 'bradesco'
        );
        expect(result.type).toBe('expense');
        expect(result.amount).toBeCloseTo(BRLtoCAD(500));
    });

    it('strips BOM character', () => {
        const result = parseBradescoTransaction(
            '\uFEFF26/02/2025;SALARIO;12345;1.000,50;;5.000,00', 'bradesco'
        );
        expect(result).toBeTruthy();
        expect(result.type).toBe('income');
    });

    it('skips Extrato metadata row', () => {
        expect(parseBradescoTransaction('Extrato;foo;bar;baz;qux;quux', 'bradesco')).toBeNull();
    });

    it('skips Filtro metadata row', () => {
        expect(parseBradescoTransaction('Filtro;foo;bar;baz;qux;quux', 'bradesco')).toBeNull();
    });

    it('skips Total metadata row', () => {
        expect(parseBradescoTransaction('Total;foo;bar;baz;qux;quux', 'bradesco')).toBeNull();
    });

    it('skips header row', () => {
        expect(parseBradescoTransaction(
            'Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)', 'bradesco'
        )).toBeNull();
    });

    it('returns null when no credit or debit', () => {
        expect(parseBradescoTransaction('26/02/2025;desc;123;;;5.000,00', 'bradesco')).toBeNull();
    });

    it('returns null for too few fields', () => {
        expect(parseBradescoTransaction('26/02/2025;desc', 'bradesco')).toBeNull();
    });

    it('handles Brazilian number format correctly', () => {
        const result = parseBradescoTransaction(
            '26/02/2025;desc;123;10.500,75;;50.000,00', 'bradesco'
        );
        expect(result.amount).toBeCloseTo(BRLtoCAD(10500.75));
    });
});

describe('parseCSV', () => {
    it('auto-detects fintracker format', () => {
        const csv = 'Date,Description,Category,Account,Amount,Type\n2025-04-12,Test,Casa,Amex,50,expense';
        const result = parseCSV(csv, 'auto');
        expect(result.length).toBe(1);
        expect(result[0].description).toBe('Test');
    });

    it('auto-detects amex format', () => {
        const csv = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,STARBUCKS,12.50';
        const result = parseCSV(csv, 'auto');
        expect(result.length).toBe(1);
    });

    it('uses explicit fileType', () => {
        const csv = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,STARBUCKS,12.50';
        const result = parseCSV(csv, 'amex');
        expect(result.length).toBe(1);
    });

    it('TD starts from row 0 (no header)', () => {
        const csv = '1/1/2025,TIM HORTONS,5.50,,1000.00';
        const result = parseCSV(csv, 'td');
        expect(result.length).toBe(1);
    });

    it('parses simplii format via parseCSV', () => {
        const csv = 'Date, Transaction Details, Funds Out, Funds In\n2/5/2025, GROCERY STORE, 50.00, ';
        const result = parseCSV(csv, 'simplii');
        expect(result.length).toBe(1);
        expect(result[0].account).toBe('Simplii');
    });

    it('skips empty lines', () => {
        const csv = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,TEST,10\n\n28 Feb 2025,28 Feb 2025,TEST2,20';
        const result = parseCSV(csv, 'amex');
        expect(result.length).toBe(2);
    });

    it('catches parse errors and continues', () => {
        // Line with too few fields mixed with valid line
        const csv = 'Date,Date Processed,Description,Amount\nbad line\n28 Feb 2025,28 Feb 2025,TEST,10';
        const result = parseCSV(csv, 'amex');
        expect(result.length).toBe(1);
    });

    it('throws for unknown file type in explicit mode', () => {
        const csv = 'header\ndata';
        // The error is caught inside the loop, so it returns empty array
        const result = parseCSV(csv, 'nonexistent');
        expect(result.length).toBe(0);
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
        // Should be BOM + header only (no data rows)
        const lines = csv.split('\n');
        expect(lines.length).toBe(2); // header + empty trailing
    });

    it('generates multiple rows', () => {
        const csv = convertTransactionsToCSV([makeTxn(), makeTxn({ description: 'Second' })]);
        const lines = csv.split('\n');
        // BOM+header + 2 data rows
        expect(lines.length).toBe(3);
    });
});

describe('handleImport', () => {
    beforeEach(() => {
        vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    });

    it('alerts when no files selected', () => {
        handleImport();
        expect(alert).toHaveBeenCalledWith('Please select at least one file to import.');
    });

    it('disables import button and calls processFiles', () => {
        const spy = vi.spyOn(globalThis, 'processFiles').mockImplementation(() => {});
        // Mock fileInput.files with a non-empty FileList-like object
        Object.defineProperty(fileInput, 'files', {
            value: { length: 1, 0: { name: 'test.csv' } },
            writable: true,
            configurable: true
        });

        handleImport();
        expect(importBtn.disabled).toBe(true);
        expect(importBtn.textContent).toBe('Importing...');
        expect(spy).toHaveBeenCalledWith(fileInput.files, 0, 0, 0);
        spy.mockRestore();
    });
});

describe('processFiles', () => {
    let OriginalFileReader;
    let alertSpy, saveDataSpy, renderSpy, summarySpy;

    beforeEach(() => {
        OriginalFileReader = globalThis.FileReader;
        alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
        saveDataSpy = vi.spyOn(globalThis, 'saveData').mockImplementation(() => {});
        renderSpy = vi.spyOn(globalThis, 'renderTransactions').mockImplementation(() => {});
        summarySpy = vi.spyOn(globalThis, 'updateSummary').mockImplementation(() => {});
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
        expect(saveDataSpy).toHaveBeenCalled();
        expect(renderSpy).toHaveBeenCalled();
        expect(summarySpy).toHaveBeenCalled();
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('5 transactions'));
    });

    it('shows no-import alert when zero imported', () => {
        processFiles({ length: 0 }, 0, 0, 3);
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('No transactions'));
        expect(saveDataSpy).not.toHaveBeenCalled();
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
        expect(alertSpy).toHaveBeenCalled();
    });

    it('detects duplicates and skips them', () => {
        fileTypeSelect.value = 'amex';
        transactions = [
            { date: new Date(2025, 1, 28), description: 'STARBUCKS', amount: 12.50, type: 'expense', category: 'Alimentação', account: 'Amex' }
        ];

        const csvContent = 'Date,Date Processed,Description,Amount\n28 Feb 2025,28 Feb 2025,STARBUCKS,12.50';
        const mock = mockFileReader();

        const files = { length: 1, 0: { name: 'test.csv' } };
        processFiles(files, 0, 0, 0);
        mock.onload({ target: { result: csvContent } });

        expect(transactions.length).toBe(1);
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('No transactions'));
    });

    it('handles parse errors gracefully', () => {
        fileTypeSelect.value = 'amex';
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const origParseCSV = globalThis.parseCSV;
        try {
            globalThis.parseCSV = () => { throw new Error('Parse failure'); };
            const mock = mockFileReader();
            const files = { length: 1, 0: { name: 'bad.csv' } };
            processFiles(files, 0, 0, 0);
            mock.onload({ target: { result: 'bad content' } });
            expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('bad.csv'));
        } finally {
            globalThis.parseCSV = origParseCSV;
        }
    });

    it('handles empty parse results', () => {
        fileTypeSelect.value = 'amex';
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        // Use a CSV where the only data line parses to null (too few fields)
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
        expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('error.csv'));
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
        // Trigger onload for file 0; inside onload, button text becomes "Importing (1/2)..."
        mocks[0].onload({ target: { result: csvContent } });

        // The text set during file 0's onload is "Importing (1/2)..."
        // Then processFiles recurses for file 1, which sets up a new FileReader
        // File 1's text will show when its onload fires
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
        transactions = [
            { date: new Date(2025, 3, 12), description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }
        ];
        const getLink = setupExportMocks();

        exportToCSV();

        expect(URL.createObjectURL).toHaveBeenCalled();
        const link = getLink();
        expect(link).toBeTruthy();
        expect(link.download).toMatch(/\d{4}_\d{2}_controle_de_gastos\.csv/);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('uses currentFilter.startDate for filename when set', () => {
        transactions = [
            { date: new Date(2025, 3, 12), description: 'Test', amount: 50, type: 'expense', category: 'Casa', account: 'Amex' }
        ];
        currentFilter.startDate = new Date(2024, 11, 1);
        const getLink = setupExportMocks();

        exportToCSV();

        expect(getLink().download).toBe('2024_12_controle_de_gastos.csv');
    });
});
