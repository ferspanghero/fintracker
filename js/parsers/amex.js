import { parseNamedMonth } from './date-helpers.js';
import { parseCSVLine } from '../utils.js';

export default {
    id: 'amex',
    name: 'American Express',
    account: 'Amex',
    hasHeader: true,

    detect(headerRow) {
        return headerRow.includes('date,date processed,description,amount');
    },

    parseDate(dateStr) {
        return parseNamedMonth(dateStr);
    },

    parseLine(line) {
        const parts = parseCSVLine(line);
        if (parts.length < 4) return null;

        const dateStr = parts[0];
        const description = parts[2];
        const amount = parseFloat(parts[3]);

        const date = this.parseDate(dateStr);
        if (!date) return null;

        const type = amount < 0 ? 'income' : 'expense';

        return {
            date,
            description,
            amount: Math.abs(amount),
            type,
            account: this.account
        };
    }
};
