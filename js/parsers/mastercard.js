import { parseMDY } from './date-helpers.js';
import { parseCSVLine } from '../utils.js';

export default {
    id: 'mastercard',
    name: 'Mastercard',
    account: 'Mastercard',
    hasHeader: true,

    detect(headerRow) {
        return headerRow.includes('description,type,card holder name,date,time,amount');
    },

    parseDate(dateStr) {
        return parseMDY(dateStr);
    },

    parseLine(line) {
        const parts = parseCSVLine(line);
        if (parts.length < 6) return null;

        const description = parts[0];
        const transactionType = parts[1];
        const cardHolder = parts[2];
        const dateStr = parts[3];
        const amount = parseFloat(parts[5]);

        const date = this.parseDate(dateStr);
        if (!date) return null;

        const type = transactionType === 'PAYMENT' ? 'income' : 'expense';

        return {
            date,
            description: `${description} (${cardHolder})`,
            amount: Math.abs(amount),
            type,
            account: this.account
        };
    }
};
