import { transactions } from './state.js';
import { categories } from './categories.js';
// Load data from local storage
export function loadData() {
    // Load transactions
    const savedTransactions = localStorage.getItem('transactions');
    if (savedTransactions) {
        const parsed = JSON.parse(savedTransactions);
        transactions.length = 0;

        // Convert date strings to Date objects
        parsed.forEach(transaction => {
            transaction.date = new Date(transaction.date);
            transactions.push(transaction);
        });
    }

    // Load categories
    const savedCategories = localStorage.getItem('categories');
    if (savedCategories) {
        Object.assign(categories, JSON.parse(savedCategories));
    }
}

// Save data to local storage
export function saveData() {
    try {
        localStorage.setItem('transactions', JSON.stringify(transactions));
        localStorage.setItem('categories', JSON.stringify(categories));
    } catch (e) {
        console.error('Failed to save data to localStorage:', e);
        alert('Could not save data. LocalStorage may be full or disabled.');
    }
}
