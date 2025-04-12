// Handle import button click
function handleImport() {
    const files = fileInput.files;
    
    if (!files.length) {
        alert('Please select at least one file to import.');
        return;
    }
    
    // Disable import button during import
    importBtn.disabled = true;
    importBtn.textContent = 'Importing...';
    
    // Process files sequentially
    processFiles(files, 0, 0);
}

// Process files sequentially
function processFiles(files, index, totalImported) {
    // If all files have been processed
    if (index >= files.length) {
        // Re-enable import button
        importBtn.disabled = false;
        importBtn.textContent = 'Import';
        
        if (totalImported > 0) {
            // Save data
            saveData();
            
            // Render transactions
            renderTransactions();
            
            // Update summary
            updateSummary();
            
            alert(`Successfully imported ${totalImported} transactions from ${files.length} file(s).`);
        } else {
            alert('No transactions were imported. Please check the file formats.');
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
            
            const importedTransactions = parseCSV(contents, fileType);
            
            if (importedTransactions.length > 0) {
                // Add imported transactions to existing ones
                transactions = [...transactions, ...importedTransactions];
                
                // Process next file
                processFiles(files, index + 1, totalImported + importedTransactions.length);
            } else {
                console.warn(`No transactions imported from file: ${file.name}`);
                // Process next file
                processFiles(files, index + 1, totalImported);
            }
        } catch (error) {
            console.error(`Error importing file ${file.name}: ${error.message}`);
            // Process next file
            processFiles(files, index + 1, totalImported);
        }
    };
    
    reader.onerror = function(event) {
        console.error(`Error reading file ${file.name}:`, event.target.error);
        alert(`Error reading file ${file.name}. Please check the file encoding and format.`);
        // Process next file
        processFiles(files, index + 1, totalImported);
    };
    
    // Try reading with UTF-8 encoding first, then fallback to Latin-1
    reader.readAsText(file, 'UTF-8');
}

// Parse CSV file based on file type
function parseCSV(csvContent, fileType) {
    const lines = csvContent.split('\n');
    const importedTransactions = [];
    let actualFileType;
    
    // Auto-detect file type if set to auto
    if (fileType === 'auto') {
        actualFileType = detectFileType(lines[0]);
    } else {
        actualFileType = fileType;
    }
    
    // Skip header row for most file types
    const startRow = (actualFileType === 'td') ? 0 : 1;
    
    for (let i = startRow; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        try {
            let transaction;
            
            switch (actualFileType) {
                case 'fintracker':
                    transaction = parseFinTrackerTransaction(line, actualFileType);
                    break;
                case 'amex':
                    transaction = parseAmexTransaction(line, actualFileType);
                    break;
                case 'mastercard':
                    transaction = parseMastercardTransaction(line, actualFileType);
                    break;
                case 'simplii':
                    transaction = parseSimpliiTransaction(line, actualFileType);
                    break;
                case 'td':
                    transaction = parseTDTransaction(line, actualFileType);
                    break;
                case 'bradesco':
                    transaction = parseBradescoTransaction(line, actualFileType);
                    break;
                default:
                    throw new Error('Unknown file type: ' + actualFileType);
            }
            
            if (transaction) {
                importedTransactions.push(transaction);
            }
        } catch (error) {
            console.error(`Error parsing line ${i + 1}: ${error.message}`);
        }
    }
    
    return importedTransactions;
}

// Detect file type based on header row
function detectFileType(headerRow) {
    headerRow = headerRow.toLowerCase().trim();
    
    if (headerRow.includes('date,description,amount,type,category,account')) {
        return 'fintracker';
    } else if (headerRow.includes('date,date processed,description,amount')) {
        return 'amex';
    } else if (headerRow.includes('"description","type","card holder name","date","time","amount"')) {
        return 'mastercard';
    } else if (headerRow.includes('date, transaction details, funds out, funds in')) {
        return 'simplii';
    } else if (headerRow.includes('data;histórico;docto.;crédito (r$);débito (r$);saldo (r$)')) {
        return 'bradesco';
    } else {
        // TD doesn't have headers, so this is a fallback
        return 'td';
    }
}

// Parse FinTracker export format
function parseFinTrackerTransaction(line, fileType) {
    // Format: Date,Description,Amount,Type,Category,Account
    const parts = parseCSVLine(line);
    if (parts.length < 6) return null;
    
    const dateStr = parts[0];
    const description = parts[1].replace(/^"|"$/g, '').replace(/""/g, '"'); // Remove quotes and handle escaped quotes
    const amount = parseFloat(parts[2]);
    const type = parts[3].toLowerCase();
    const category = parts[4] || categorizeTransaction(description, type);
    const account = parts[5];
    
    // Parse date (format: YYYY-MM-DD)
    const date = parseDate(dateStr, fileType);
    
    // Add any new categories that don't exist yet
    if (category && !categories[type].includes(category)) {
        categories[type].push(category);
    }
    
    return {
        date,
        description,
        amount,
        type,
        category,
        account
    };
}

// Parse American Express transaction
function parseAmexTransaction(line, fileType) {
    // Format: Date,Date Processed,Description,Amount
    const parts = parseCSVLine(line);
    if (parts.length < 4) return null;
    
    const dateStr = parts[0];
    const description = parts[2];
    const amount = parseFloat(parts[3]);
    
    // Parse date (format: DD-MMM-YY)
    const date = parseDate(dateStr, fileType);
    
    // Determine transaction type (negative amount = payment/income, positive = expense)
    const type = amount < 0 ? 'income' : 'expense';
    
    // Determine category based on description
    const category = categorizeTransaction(description, type);
    
    return {
        date,
        description,
        amount: Math.abs(amount),
        type,
        category,
        account: 'Amex'
    };
}

// Parse Mastercard transaction
function parseMastercardTransaction(line, fileType) {
    // Format: Description,Type,Card Holder Name,Date,Time,Amount
    const parts = parseCSVLine(line);
    if (parts.length < 6) return null;
    
    const description = parts[0];
    const transactionType = parts[1];
    const cardHolder = parts[2];
    const dateStr = parts[3];
    const amount = parseFloat(parts[5]);
    
    // Parse date (format: M/D/YYYY)
    const date = parseDate(dateStr, fileType);
    
    // Determine transaction type (PAYMENT = income, PURCHASE = expense)
    const type = transactionType === 'PAYMENT' ? 'income' : 'expense';
    
    // Determine category based on description
    const category = categorizeTransaction(description, type);
    
    return {
        date,
        description: `${description} (${cardHolder})`,
        amount: Math.abs(amount),
        type,
        category,
        account: 'Mastercard'
    };
}

// Parse Simplii transaction
function parseSimpliiTransaction(line, fileType) {
    // Format: Date, Transaction Details, Funds Out, Funds In
    const parts = parseCSVLine(line);
    if (parts.length < 4) return null;
    
    const dateStr = parts[0].trim();
    const description = parts[1].trim();
    const fundsOut = parts[2].trim();
    const fundsIn = parts[3].trim();
    
    // Parse date (format: M/D/YYYY)
    const date = parseDate(dateStr, fileType);
    
    // Determine amount and type
    let amount, type;
    if (fundsIn && parseFloat(fundsIn) > 0) {
        amount = parseFloat(fundsIn);
        type = 'income';
    } else {
        amount = parseFloat(fundsOut);
        type = 'expense';
    }
    
    // Determine category based on description
    const category = categorizeTransaction(description, type);
    
    return {
        date,
        description,
        amount,
        type,
        category,
        account: 'Simplii'
    };
}

// Parse TD transaction
function parseTDTransaction(line, fileType) {
    // Format: Date,Description,Amount Out,Amount In,Balance
    const parts = parseCSVLine(line);
    if (parts.length < 3) return null;
    
    const dateStr = parts[0];
    const description = parts[1];
    
    // TD format has separate columns for money out and in
    // If amount out is present, it's an expense
    // If amount in is present, it's income
    let amount, type;
    if (parts[2] && parseFloat(parts[2]) > 0) {
        amount = parseFloat(parts[2]);
        type = 'expense';
    } else if (parts[3] && parseFloat(parts[3]) > 0) {
        amount = parseFloat(parts[3]);
        type = 'income';
    } else {
        // Skip if no amount
        return null;
    }
    
    // Parse date (format: M/D/YYYY)
    const date = parseDate(dateStr, fileType);
    
    // Determine category based on description
    const category = categorizeTransaction(description, type);
    
    return {
        date,
        description,
        amount,
        type,
        category,
        account: 'TD'
    };
}

// Parse Bradesco bank statement
function parseBradescoTransaction(line, fileType) {
    // Remove BOM character if present
    line = line.replace(/^\uFEFF/, '');

    // Split by semicolon and trim each part
    const parts = line.split(';').map(part => part.trim());
    
    // Skip empty or metadata rows
    if (parts.length < 6 || 
        !parts[0] || 
        parts[0].startsWith('Extrato') || 
        parts[0].startsWith('Filtro') || 
        parts[0].startsWith('Os dados') || 
        parts[0].startsWith('Últimos') || 
        parts[0].startsWith('Total')) {
        return null;
    }
    
    // Skip header row
    if (parts[0].toLowerCase() === 'data') {
        return null;
    }
    
    const dateStr = parts[0];
    const description = parts[1];
    
    // Parse credit and debit amounts (first eliminate dots, then replaces comma with dot for decimal)
    const creditAmount = parts[3] ? parseFloat(parts[3].replace('.', '').replace(',', '.')) : 0;
    const debitAmount = parts[4] ? parseFloat(parts[4].replace('.', '').replace(',', '.')) : 0;
    
    // Determine amount and type
    let amount, type;
    if (creditAmount > 0) {
        amount = BRLtoCAD(creditAmount);
        type = 'income';
    } else if (debitAmount > 0) {
        amount = BRLtoCAD(debitAmount);
        type = 'expense';
    } else {
        return null;
    }

    // Parse date (format: DD/MM/YYYY)
    const date = parseDate(dateStr, fileType);
    
    // Determine category based on description
    const category = categorizeTransaction(description, type);
    
    return {
        date,
        description,
        amount,
        type,
        category,
        account: 'Bradesco'
    };
}

// Export to CSV
function exportToCSV() {
    // Get filtered transactions
    const filteredTransactions = getFilteredTransactions();
    
    // Convert to CSV
    const csvContent = convertTransactionsToCSV(filteredTransactions);
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    // Set link properties
    link.href = url;
    link.download = `fintracker_export_${new Date().toISOString().split('T')[0]}.csv`;
    
    // Trigger download
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Convert transactions to CSV format
function convertTransactionsToCSV(transactionsToExport) {
    // Add UTF-8 BOM
    const BOM = '\uFEFF';
        
    // Define CSV header
    const header = 'Date,Description,Amount,Type,Category,Account\n';
    
    // Convert each transaction to CSV row
    const rows = transactionsToExport.map(transaction => {
        const date = transaction.date.toISOString().split('T')[0];
        const description = `"${transaction.description.replace(/"/g, '""')}"`;
        const amount = transaction.amount;
        const type = transaction.type;
        const category = transaction.category;
        const account = transaction.account;
        
        return `${date},${description},${amount},${type},${category},${account}`;
    }).join('\n');
    
    return BOM + header + rows;
}
