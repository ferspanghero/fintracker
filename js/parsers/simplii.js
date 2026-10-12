import { parseMDY } from './date-helpers.js';
import { parseCSVLine } from '../utils.js';
import { INCOME, EXPENSE } from '../constants.js';

export default {
    id: 'simplii',
    name: 'Simplii Financial',
    account: 'Simplii',
    hasHeader: true,

    detect(headerRow) {
        return headerRow.includes('date, transaction details, funds out, funds in');
    },

    parseDate(dateStr) {
        return parseMDY(dateStr);
    },

    parseLine(line) {
        const parts = parseCSVLine(line);
        if (parts.length < 4) return null;

        const dateStr = parts[0].trim();
        const description = parts[1].trim();
        const fundsOut = parts[2].trim();
        const fundsIn = parts[3].trim();

        const date = this.parseDate(dateStr);
        if (!date) return null;

        let amount, type;
        if (fundsIn && parseFloat(fundsIn) > 0) {
            amount = parseFloat(fundsIn);
            type = INCOME;
        } else {
            amount = parseFloat(fundsOut);
            type = EXPENSE;
        }

        return {
            date,
            description,
            amount,
            type,
            account: this.account
        };
    }
};
