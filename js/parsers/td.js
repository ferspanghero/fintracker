import { parseMDY } from './date-helpers.js';
import { parseCSVLine } from '../utils.js';
import { INCOME, EXPENSE } from '../constants.js';

export default {
    id: 'td',
    name: 'TD Bank',
    account: 'TD',
    hasHeader: false,

    detect() {
        // TD has no header; it's the fallback parser
        return true;
    },

    parseDate(dateStr) {
        return parseMDY(dateStr);
    },

    parseLine(line) {
        const parts = parseCSVLine(line);
        if (parts.length < 3) return null;

        const dateStr = parts[0];
        const description = parts[1];

        let amount, type;
        if (parts[2] && parseFloat(parts[2]) > 0) {
            amount = parseFloat(parts[2]);
            type = EXPENSE;
        } else if (parts[3] && parseFloat(parts[3]) > 0) {
            amount = parseFloat(parts[3]);
            type = INCOME;
        } else {
            return null;
        }

        const date = this.parseDate(dateStr);
        if (!date) return null;

        return {
            date,
            description,
            amount,
            type,
            account: this.account
        };
    }
};
