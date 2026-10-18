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

export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** @returns {string} 'Sep 2026' for month key '2026-09' */
export const monthLabel = key => `${MONTH_NAMES[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;

/** @returns {string} `value` with thousands separators and exactly `decimals` decimals */
export const formatNumber = (value, decimals) =>
    value.toLocaleString('en-CA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/** @returns {string} a ratio as '+12.5%' / '-3.0%' / '0.0%', or '—' when null */
export function formatSignedPercent(ratio) {
    if (ratio === null) {
        return '—';
    }

    const rounded = Number((ratio * 100).toFixed(1));

    // Rounding can leave "-0.0"; show an unchanged value without a sign.
    return rounded === 0 ? '0.0%' : `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}

/** @returns {string} '$1,234' or '-$1,234' */
export const formatMoney = (value, decimals = 0) => `${value < 0 ? '-' : ''}$${formatNumber(Math.abs(value), decimals)}`;

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

/**
 * Reads a File or Blob as UTF-8 text (FileReader works in every supported browser and in jsdom).
 * @returns {Promise<string>} rejects with the reader's error
 */
export function readFileText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsText(file, 'UTF-8');
    });
}
