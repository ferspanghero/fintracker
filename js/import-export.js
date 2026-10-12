import { transactions, currentFilter, settings } from './state.js';
import { fileInput, fileTypeSelect, importBtn, importResultModal, importResultTitle, importResultBody } from './dom.js';
import { escapeHTML, monthKey } from './utils.js';
import { categorizeTransaction, populateCategoryDropdowns, PERSONAL_KEYWORDS_PATH } from './categories.js';
import { getFilteredTransactions, saveAndRefresh } from './transactions.js';
import { sortTransactions } from './ui.js';
import { getParserById, detectParser } from './parsers/index.js';
import { loadIgnorePrefixes, isIgnored } from './ignore-rules.js';

// Top-level await, like categoryKeywords in categories.js — main.js already
// handles module evaluation finishing after DOMContentLoaded.
const ignorePrefixes = await loadIgnorePrefixes(PERSONAL_KEYWORDS_PATH);

export function getTransactionKey(transaction) {
    const dateStr = transaction.date ? transaction.date.toISOString().split('T')[0] : 'no-date';
    return `${dateStr}-${transaction.description}-${transaction.amount}-${transaction.type}-${transaction.account}`;
}

// Handle import button click
export function handleImport() {
    const files = fileInput.files;

    if (!files.length) {
        alert('Please select at least one file to import.');
        return;
    }

    // Disable import button during import
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';

    // Process files sequentially
    processFiles(files, 0);
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
    importResultModal.style.display = 'block';
}

/**
 * Reads and imports files one at a time, then shows the result dialog.
 * @param {FileList|{length: number}} files
 * @param {number} index file to process next
 * @param {object} totals running counts carried between files
 */
export function processFiles(files, index, totals = emptyTotals()) {
    const next = () => processFiles(files, index + 1, totals);

    // If all files have been processed
    if (index >= files.length) {
        // Re-enable import button
        importBtn.disabled = false;
        importBtn.textContent = 'Import';

        if (totals.imported > 0) {
            // A FinTracker export can bring new categories into Settings.
            populateCategoryDropdowns();
            saveAndRefresh();
        }

        showImportResult({ ...totals, fileCount: files.length, months: summarizeByMonth(totals.added) });

        return;
    }

    // Get current file
    const file = files[index];
    const reader = new FileReader();

    reader.onload = function(e) {
        const contents = e.target.result;
        const fileType = fileTypeSelect.value;

        try {
            // Update import button text to show progress
            importBtn.textContent = `Importing (${index + 1}/${files.length})...`;

            const parseResult = parseCSV(contents, fileType);
            const importedTransactions = parseResult.transactions;
            totals.errors += parseResult.errorCount;

            if (importedTransactions.length === 0) {
                console.warn(`No transactions imported from file: ${file.name}`);
            }

            const transactionKeys = new Set(transactions.map(getTransactionKey));

            importedTransactions.forEach(importedTransaction => {
                if (isIgnored(importedTransaction.description, ignorePrefixes)) {
                    totals.ignored++;
                    return;
                }

                // Check if this transaction has been seen before. Note we do not update transactionKeys because
                // a file may contain valid duplicates that should all be added. This should only prevent duplicates
                // in different files.
                if (!transactionKeys.has(getTransactionKey(importedTransaction))) {
                    transactions.push(importedTransaction);
                    totals.added.push(importedTransaction);
                    totals.imported++;
                } else {
                    totals.duplicates++;
                }
            });
        } catch (error) {
            console.error(`Error importing file ${file.name}: ${error.message}`);
            totals.errors++;
            totals.messages.push(`${file.name}: ${error.message}`);
        }

        next();
    };

    reader.onerror = function(event) {
        console.error(`Error reading file ${file.name}:`, event.target.error);
        totals.errors++;
        totals.messages.push(`${file.name}: couldn't be read. Check the file encoding and format.`);
        next();
    };

    // Try reading with UTF-8 encoding first, then fallback to Latin-1
    reader.readAsText(file, 'UTF-8');
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
    if (fileType === 'auto') {
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

            // Parser-specific post-processing (e.g., FinTracker's category side-effect)
            if (parser.afterParse) {
                parser.afterParse(transaction, { settings });
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
    return parser ? parser.id : 'td';
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
