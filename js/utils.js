export function dateStrInputToLocalDate(dateStrInput) {
    if (!dateStrInput) return null;
    // Format: YYYY-MM-DD (e.g., 2025-02-26)
    const [year, month, day] = dateStrInput.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    if (isNaN(date.getTime())) return null;
    return date;
}

/**
 * 'YYYY-MM' for a date's local calendar month.
 * @param {Date} date
 * @returns {string}
 */
export function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 'YYYY-MM-DD' of a date's local calendar day, as a date input expects.
 * @param {Date} date
 * @returns {string}
 */
export function dateInputValue(date) {
    return `${monthKey(date)}-${String(date.getDate()).padStart(2, '0')}`;
}

// Parse CSV line, handling quoted values
export function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
                // Escaped quote ("") → emit single "
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
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

/**
 * Converts a BRL amount to CAD.
 * @param {number} amount in BRL
 * @param {number} rate CAD per BRL
 * @returns {number}
 */
export function BRLtoCAD(amount, rate) {
    return amount * rate;
}

export function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
