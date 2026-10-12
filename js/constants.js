// Literals shared across modules: transaction types and the currency all totals are reported in.

export const INCOME = 'income';
export const EXPENSE = 'expense';
/** Both transaction types, expense first (the order Settings and backups list them in). */
export const TRANSACTION_TYPES = Object.freeze([EXPENSE, INCOME]);
export const BASE_CURRENCY = 'CAD';
