export function dateStrInputToLocalDate(dateStrInput) {
    if (!dateStrInput) return null;
    // Format: YYYY-MM-DD (e.g., 2025-02-26)
    const [year, month, day] = dateStrInput.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
    if (isNaN(date.getTime())) return null;
    return date;
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

export const BRL_TO_CAD_RATE = 0.25;

export function BRLtoCAD(amount) {
    return amount * BRL_TO_CAD_RATE;
}

export function escapeHTML(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
