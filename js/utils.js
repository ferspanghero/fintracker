// Parse date from various formats
function parseDate(dateStr) {
    // Try to parse various date formats
    let date;
    
    // Format: DD-MMM-YY (e.g., 28-Feb-25)
    if (dateStr.match(/^\d{1,2}-[A-Za-z]{3}-\d{2}$/)) {
        const parts = dateStr.split('-');
        const day = parseInt(parts[0], 10);
        const monthStr = parts[1];
        const year = 2000 + parseInt(parts[2], 10); // Assuming 20xx for year
        
        const months = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
            'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
        };
        
        date = new Date(year, months[monthStr], day);
    }
    // Format: M/D/YYYY (e.g., 2/26/2025)
    else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const parts = dateStr.split('/');
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        date = new Date(year, month, day);
    }
    // Format: YYYY-MM-DD (e.g., 2025-02-26)
    else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = dateStrInputToLocalDate(dateStr);
    }
    // Format: M/D/YYYY (e.g., 2/26/2025) - alternative format
    else if (dateStr.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
        const parts = dateStr.split('/');
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = 2000 + parseInt(parts[2], 10); // Assuming 20xx for year
        
        date = new Date(year, month, day);
    }
    // Format: MM/DD/YYYY (e.g., 02/26/2025)
    else if (dateStr.match(/^\d{2}\/\d{2}\/\d{4}$/)) {
        const parts = dateStr.split('/');
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        
        date = new Date(year, month, day);
    }
    // Format: YYYY/MM/DD (e.g., 2025/02/26)
    else if (dateStr.match(/^\d{4}\/\d{2}\/\d{2}$/)) {
        const parts = dateStr.split('/');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        
        date = new Date(year, month, day);
    }
    // If all else fails, try the built-in date parser
    else {
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
