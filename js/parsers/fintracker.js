import { parseYMD } from './date-helpers.js';
import { parseCSVLine } from '../utils.js';
import { TRANSACTION_TYPES } from '../constants.js';

export default {
    id: 'fintracker',
    name: 'FinTracker Export',
    hasHeader: true,

    detect(headerRow) {
        return headerRow.includes('date,description,category,account,amount,type');
    },

    parseDate(dateStr) {
        return parseYMD(dateStr);
    },

    parseLine(line) {
        const parts = parseCSVLine(line);
        if (parts.length < 6) return null;

        const dateStr = parts[0];
        const description = parts[1];
        const category = parts[2] || '';
        const account = parts[3];
        const amount = parseFloat(parts[4]);
        const type = parts[5].toLowerCase();

        if (!TRANSACTION_TYPES.includes(type)) {
            throw new Error(`Invalid type "${parts[5]}"`);
        }

        const date = this.parseDate(dateStr);
        if (!date) return null;

        return {
            date,
            description,
            amount,
            type,
            category,
            account
        };
    }
};
