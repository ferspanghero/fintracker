import { parseDMY } from './date-helpers.js';
import { BRLtoCAD } from '../utils.js';

export default {
    id: 'bradesco',
    name: 'Bradesco',
    account: 'Bradesco',
    hasHeader: true,

    detect(headerRow) {
        return headerRow.includes('data;histórico;docto.;crédito (r$);débito (r$);saldo (r$)');
    },

    parseDate(dateStr) {
        return parseDMY(dateStr);
    },

    parseLine(line) {
        const parts = line.split(';').map(p => p.trim());

        // Handle BOM in first field
        if (parts[0]) {
            parts[0] = parts[0].replace(/^\uFEFF/, '');
        }

        if (parts.length < 6 ||
            !parts[0] ||
            parts[0].startsWith('Extrato') ||
            parts[0].startsWith('Filtro') ||
            parts[0].startsWith('Os dados') ||
            parts[0].startsWith('Últimos') ||
            parts[0].startsWith('Total')) {
            return null;
        }

        // Skip header row
        if (parts[0].toLowerCase() === 'data') {
            return null;
        }

        const dateStr = parts[0];
        const description = parts[1];

        // Parse credit and debit amounts (eliminate thousand-separator dots, replace comma with dot)
        const creditAmount = parts[3] ? parseFloat(parts[3].replace(/\./g, '').replace(',', '.')) : 0;
        const debitAmount = parts[4] ? parseFloat(parts[4].replace(/\./g, '').replace(',', '.')) : 0;

        let amount, type;
        if (creditAmount > 0) {
            amount = BRLtoCAD(creditAmount);
            type = 'income';
        } else if (debitAmount > 0) {
            amount = BRLtoCAD(debitAmount);
            type = 'expense';
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
