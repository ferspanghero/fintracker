import { transactions, currentFilter } from './state.js';
import { fileInput, fileTypeSelect, importBtn } from './dom.js';
import { categories, categorizeTransaction, PERSONAL_KEYWORDS_PATH } from './categories.js';
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
    processFiles(files, 0, 0, 0, 0, 0);
}

// Process files sequentially
export function processFiles(files, index, totalImported, totalDuplicates, totalErrors, totalIgnored = 0) {
    // If all files have been processed
    if (index >= files.length) {
        // Re-enable import button
        importBtn.disabled = false;
        importBtn.textContent = 'Import';

        const ignoredMsg = totalIgnored > 0 ? ` ${totalIgnored} transaction(s) matched the ignore list.` : '';
        const errorMsg = totalErrors > 0 ? ` ${totalErrors} error(s) occurred.` : '';

        if (totalImported > 0) {
            saveAndRefresh();

            alert(`Successfully imported ${totalImported} transactions from ${files.length} file(s). ${totalDuplicates} duplicates were ignored.${ignoredMsg}${errorMsg}`);
        } else {
            alert(`No transactions were imported. ${totalDuplicates} duplicates were ignored.${ignoredMsg}${errorMsg}`);
        }

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
            totalErrors += parseResult.errorCount;

            if (importedTransactions.length > 0) {
                const transactionKeys = new Set(transactions.map(getTransactionKey));

                importedTransactions.forEach(importedTransaction => {
                    if (isIgnored(importedTransaction.description, ignorePrefixes)) {
                        totalIgnored++;
                        return;
                    }

                    const importedTransactionKey = getTransactionKey(importedTransaction);

                    // Check if this transaction has been seen before. Note we do not update transactionKeys because
                    // a file may contain valid duplicates that should all be added. This should only prevent duplicates
                    // in different files.
                    if (!transactionKeys.has(importedTransactionKey)) {
                        transactions.push(importedTransaction);
                        totalImported++;
                    } else {
                        totalDuplicates++;
                    }
                });

                // Process next file
                processFiles(files, index + 1, totalImported, totalDuplicates, totalErrors, totalIgnored);
            } else {
                console.warn(`No transactions imported from file: ${file.name}`);
                // Process next file
                processFiles(files, index + 1, totalImported, totalDuplicates, totalErrors, totalIgnored);
            }
        } catch (error) {
            console.error(`Error importing file ${file.name}: ${error.message}`);
            totalErrors++;
            // Process next file
            processFiles(files, index + 1, totalImported, totalDuplicates, totalErrors, totalIgnored);
        }
    };

    reader.onerror = function(event) {
        console.error(`Error reading file ${file.name}:`, event.target.error);
        alert(`Error reading file ${file.name}. Please check the file encoding and format.`);
        totalErrors++;
        // Process next file
        processFiles(files, index + 1, totalImported, totalDuplicates, totalErrors, totalIgnored);
    };

    // Try reading with UTF-8 encoding first, then fallback to Latin-1
    reader.readAsText(file, 'UTF-8');
}

// Parse CSV file using parser registry
export function parseCSV(csvContent, fileType) {
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

    const startRow = parser.hasHeader ? 1 : 0;

    for (let i = startRow; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
            const transaction = parser.parseLine(line);
            if (!transaction) continue;

            // Orchestrator-owned: categorization (only when parser didn't set one)
            if (!transaction.category) {
                transaction.category = categorizeTransaction(transaction.description, transaction.type);
            }

            // Parser-specific post-processing (e.g., FinTracker's category side-effect)
            if (parser.afterParse) {
                parser.afterParse(transaction, { categories });
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
