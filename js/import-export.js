import { transactions, currentFilter, settings } from './state.js';
import { ensureCategory } from './settings.js';
import { fileInput, fileTypeSelect, importBtn, importResultModal, importResultTitle, importResultBody } from './dom.js';
import { escapeHTML, monthKey, readFileText } from './utils.js';
import { categorizeTransaction, populateCategoryDropdowns, PERSONAL_KEYWORDS_PATH } from './categories.js';
import { getFilteredTransactions, saveAndRefresh } from './transactions.js';
import { sortTransactions } from './ui.js';
import { getParserById, detectParser, AUTO_DETECT, FALLBACK_PARSER_ID } from './parsers/index.js';
import { loadIgnorePrefixes, isIgnored } from './ignore-rules.js';
import { openModal } from './modal.js';

// Top-level await, like categoryKeywords in categories.js — main.js already
// handles module evaluation finishing after DOMContentLoaded.
const ignorePrefixes = await loadIgnorePrefixes(PERSONAL_KEYWORDS_PATH);

export function getTransactionKey(transaction) {
    const dateStr = transaction.date ? transaction.date.toISOString().split('T')[0] : 'no-date';
    return `${dateStr}-${transaction.description}-${transaction.amount}-${transaction.type}-${transaction.account}`;
}

/**
 * Import button: reads the selected files and imports them.
 * @returns {Promise<void>|undefined} settles once the result dialog is shown; undefined when no file is selected
 */
export function handleImport() {
    const files = fileInput.files;

    if (!files.length) {
        alert('Please select at least one file to import.');
        return;
    }

    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';

    return processFiles([...files]);
}

const emptyTotals = () => ({ imported: 0, duplicates: 0, ignored: 0, errors: 0, added: [], messages: [] });

/**
 * Counts transactions per local calendar month.
 * @param {{date: Date}[]} added
 * @returns {{month: string, count: number}[]} ascending by month ('YYYY-MM')
 */
export function summarizeByMonth(added) {
    const counts = new Map();

    added.forEach(({ date }) => {
        const month = monthKey(date);
        counts.set(month, (counts.get(month) ?? 0) + 1);
    });

    return [...counts].sort(([a], [b]) => a.localeCompare(b)).map(([month, count]) => ({ month, count }));
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/**
 * Builds the import-result dialog text.
 * @param {{fileCount: number, imported: number, duplicates: number, ignored: number, errors: number,
 *          months: {month: string, count: number}[], messages: string[]}} result
 * @returns {{title: string, headline: string, months: string[], counts: string, messages: string[]}}
 */
export function formatImportResult(result) {
    const files = plural(result.fileCount, 'file');
    const headline = result.imported > 0
        ? `Imported ${plural(result.imported, 'transaction')} from ${files}:`
        : `No transactions were imported from ${files}.`;

    return {
        title: 'Import complete',
        headline,
        months: result.months.map(({ month, count }) => `${month}: ${count} added`),
        counts: `${plural(result.duplicates, 'duplicate')} skipped · ${result.ignored} matched the ignore list · ${plural(result.errors, 'error')}`,
        messages: result.messages
    };
}

function showImportResult(result) {
    const text = formatImportResult(result);
    const listItems = items => items.map(item => `<li>${escapeHTML(item)}</li>`).join('');

    importResultTitle.textContent = text.title;
    importResultBody.innerHTML = `
        <p>${escapeHTML(text.headline)}</p>
        ${text.months.length ? `<ul>${listItems(text.months)}</ul>` : ''}
        <p class="hint">${escapeHTML(text.counts)}</p>
        ${text.messages.length ? `<ul class="message">${listItems(text.messages)}</ul>` : ''}
    `;
    // The Import button was disabled (and lost focus) while reading, so return focus to it explicitly.
    openModal(importResultModal, { returnFocus: importBtn });
}

// Adds one file's rows to `transactions`, updating the running totals.
function importContents(contents, file, totals) {
    const parseResult = parseCSV(contents, fileTypeSelect.value);
    totals.errors += parseResult.errorCount;

    if (parseResult.transactions.length === 0) {
        console.warn(`No transactions imported from file: ${file.name}`);
    }

    // Built once per file, so a file may still contain repeated rows that are all
    // added; only rows already stored by an earlier import count as duplicates.
    const transactionKeys = new Set(transactions.map(getTransactionKey));

    parseResult.transactions.forEach(transaction => {
        if (isIgnored(transaction.description, ignorePrefixes)) {
            totals.ignored++;

            return;
        }

        if (transactionKeys.has(getTransactionKey(transaction))) {
            totals.duplicates++;

            return;
        }

        // Only rows that are kept may bring a category into Settings (e.g. from a FinTracker export).
        transaction.category = ensureCategory(settings, transaction.type, transaction.category);
        transactions.push(transaction);
        totals.added.push(transaction);
        totals.imported++;
    });
}

/**
 * Reads and imports files one at a time, then shows the result dialog.
 * @param {File[]} files
 * @param {(file: File) => Promise<string>} readText file reader, injectable for tests
 * @returns {Promise<void>}
 */
export async function processFiles(files, readText = readFileText) {
    const totals = emptyTotals();

    for (const [index, file] of files.entries()) {
        importBtn.textContent = `Importing (${index + 1}/${files.length})...`;
        let contents;

        try {
            contents = await readText(file);
        } catch (error) {
            console.error(`Error reading file ${file.name}:`, error);
            totals.errors++;
            totals.messages.push(`${file.name}: couldn't be read. Check the file encoding and format.`);
            continue;
        }

        try {
            importContents(contents, file, totals);
        } catch (error) {
            console.error(`Error importing file ${file.name}: ${error.message}`);
            totals.errors++;
            totals.messages.push(`${file.name}: ${error.message}`);
        }
    }

    importBtn.disabled = false;
    importBtn.textContent = 'Import';

    if (totals.imported > 0) {
        // Imported rows can bring new categories into Settings.
        populateCategoryDropdowns();
        saveAndRefresh();
    }

    showImportResult({ ...totals, fileCount: files.length, months: summarizeByMonth(totals.added) });
}

/**
 * Parses a CSV file with the selected (or auto-detected) parser.
 * @param {string} csvContent
 * @param {string} fileType parser id or 'auto'
 * @param {{rates: object}} ctx passed to every parser's parseLine; defaults to the Settings rates
 * @returns {{transactions: object[], errorCount: number}}
 * @throws {Error} for an unknown file type or when the parser rejects the context
 */
export function parseCSV(csvContent, fileType, ctx = { rates: settings.rates }) {
    const lines = csvContent.split('\n');
    const importedTransactions = [];
    let errorCount = 0;

    // Resolve parser from registry
    let parser;
    if (fileType === AUTO_DETECT) {
        parser = detectParser(lines[0]);
    } else {
        parser = getParserById(fileType);
    }

    if (!parser) {
        throw new Error('Unknown file type: ' + fileType);
    }

    const contextError = parser.validateContext?.(ctx);

    if (contextError) {
        throw new Error(contextError);
    }

    const startRow = parser.hasHeader ? 1 : 0;

    for (let i = startRow; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
            const transaction = parser.parseLine(line, ctx);
            if (!transaction) continue;

            // Orchestrator-owned: categorization (only when parser didn't set one)
            if (!transaction.category) {
                transaction.category = categorizeTransaction(transaction.description, transaction.type);
            }

            importedTransactions.push(transaction);
        } catch (error) {
            console.error(`Error parsing line ${i + 1}: ${error.message}`);
            errorCount++;
        }
    }

    return { transactions: importedTransactions, errorCount };
}

// Backward-compatible wrapper delegating to the parser registry
export function detectFileType(headerRow) {
    const parser = detectParser(headerRow);
    return parser ? parser.id : FALLBACK_PARSER_ID;
}

// Export to CSV
export function exportToCSV() {
    // Get filtered transactions
    const sortedTransactions = sortTransactions(getFilteredTransactions());

    // Convert to CSV
    const csvContent = convertTransactionsToCSV(sortedTransactions);

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    // Set link properties
    const date = currentFilter.startDate ? currentFilter.startDate : new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    link.href = url;
    link.download = `${year}_${month}_controle_de_gastos.csv`;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Convert transactions to CSV format
export function convertTransactionsToCSV(transactionsToExport) {
    // Add UTF-8 BOM
    const BOM = '\uFEFF';

    // Define CSV header
    const header = 'Date,Description,Category,Account,Amount,Type\n';

    const escapeCSVField = (field) => `"${String(field).replace(/"/g, '""')}"`;

    // Convert each transaction to CSV row
    const rows = transactionsToExport.map(transaction => {
        const date = transaction.date.toISOString().split('T')[0];
        const description = escapeCSVField(transaction.description);
        const category = escapeCSVField(transaction.category);
        const account = escapeCSVField(transaction.account);
        const amount = transaction.amount;
        const type = transaction.type;

        return `${date},${description},${category},${account},${amount},${type}`;
    }).join('\n');

    return BOM + header + rows;
}
