// Parse date from various formats
function parseDate(dateStr, fileType) {
    // Try to parse various date formats
    let date;
    let parts;
    let day;
    let month;
    let year;

    switch (fileType) {
        case 'amex':
            // Format: DD-MMM-YY (e.g., 28-Feb-25)
            parts = dateStr.split('-');
            day = parseInt(parts[0], 10);
            month = parts[1];
            year = 2000 + parseInt(parts[2], 10); // Assuming 20xx for year
            
            const months = {
                'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
                'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
            };
            
            date = new Date(year, months[month], day);
            break;
        case 'fintracker':
        case 'mastercard':
        case 'simplii':
        case 'td':
            // Format: M(M)/D(D)/YYYY (e.g., 2/5/2025, 02/05/2025)
            parts = dateStr.split('/');
            month = parseInt(parts[0], 10) - 1;
            day = parseInt(parts[1], 10);
            year = parseInt(parts[2], 10);
            
            date = new Date(year, month, day);
            break;
        case 'bradesco':
            // Format: DD/MM/YYYY (e.g., 26/02/2025)
            parts = dateStr.split('/');
            month = parseInt(parts[1], 10) - 1;
            day = parseInt(parts[0], 10);
            year = parseInt(parts[2], 10);
            
            date = new Date(year, month, day);
            break;
        default:
            // If all else fails, try the built-in date parser
            date = new Date(dateStr);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
        console.error(`Invalid date: ${dateStr}`);
        // Default to today if date is invalid
        date = new Date();
    }
    
    return date;
}

function dateStrInputToLocalDate(dateStrInput) {
    // Format: YYYY-MM-DD (e.g., 2025-02-26)
    const [year, month, day] = dateStrInput.split('-');
    return new Date(year, month - 1, day); // Uses local time (month is zero-indexed)
}

// Parse CSV line, handling quoted values
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current);
    return result;
}

function BRLtoCAD(amount) {
    return amount * 0.25;
}
