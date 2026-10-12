import { parseYMD } from './date-helpers.js';
import { parseCSVLine } from '../utils.js';
import { findCategory, addCategory } from '../settings.js';
import { UNCATEGORIZED } from '../category-engine.js';

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

        if (type !== 'income' && type !== 'expense') {
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
    },

    // Keeps imported categories inside the Settings list: a known name in another
    // case takes the stored spelling, an unknown one is added, a blank one is
    // filed under Sem Categoria.
    afterParse(transaction, { settings }) {
        const { category, type } = transaction;
        const existing = findCategory(settings, type, category);

        if (existing) {
            transaction.category = existing;
        } else if (category.trim()) {
            transaction.category = addCategory(settings, type, category).name;
        } else {
            transaction.category = UNCATEGORIZED;
        }
    }
};
