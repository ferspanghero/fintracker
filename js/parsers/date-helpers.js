export function validateDate(date) {
    return (date instanceof Date && !isNaN(date.getTime())) ? date : null;
}

// YYYY-MM-DD (FinTracker export format)
export function parseYMD(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    return validateDate(new Date(year, month, day));
}

// DD MMM YYYY (Amex format)
const MONTH_MAP = {
    'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5,
    'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11
};

export function parseNamedMonth(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split(' ');
    if (parts.length < 3) return null;
    const day = parseInt(parts[0], 10);
    const month = MONTH_MAP[parts[1]];
    const year = parseInt(parts[2], 10);
    if (month === undefined) return null;
    return validateDate(new Date(year, month, day));
}

// M/D/YYYY (Mastercard, Simplii, TD format)
export function parseMDY(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    const month = parseInt(parts[0], 10) - 1;
    const day = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    return validateDate(new Date(year, month, day));
}

// DD/MM/YYYY (Bradesco format)
export function parseDMY(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    return validateDate(new Date(year, month, day));
}
