// Shared setup for the Playwright specs. All data is synthetic.
import { expect } from '@playwright/test';
import { migrateSettings } from '../../js/settings.js';

export const SAMPLE_CATEGORIES = {
    expense: ['Casa', 'Mercado', 'Alimentação', 'Lazer', 'Outro', 'Sem Categoria'],
    income: ['Trabalho', 'Reembolso', 'Outro', 'Sem Categoria']
};

export const NOW = new Date(2026, 9, 11, 12, 0);

// Settings in the current stored format; assets get no Type, so they keep the names given here.
export function makeSettings({ assets = [], rates = {}, categories = SAMPLE_CATEGORIES } = {}) {
    return migrateSettings({
        rates: { USD: null, BRL: null, date: null, refreshedAt: null, ...rates },
        categories: structuredClone(categories),
        assets: assets.map(([id, name, currency, archived = false]) => ({ id, name, currency, archived }))
    });
}

// tx('2026-09-01', 'Rent', 100, 'expense', 'Casa') — the date is a local calendar day.
export const tx = (day, description, amount, type, category, account = 'TD') => ({ day, description, amount, type, category, account });

/**
 * Opens the app with a fixed clock and, unless `fresh`, seeded LocalStorage.
 * Seeding happens once per tab so reloads keep what the test changed.
 */
export async function openApp(page, { settings, transactions = [], balances = {}, closedMonths = [], registeredRoom = [], fresh = false } = {}) {
    await page.clock.setFixedTime(NOW);
    await page.addInitScript(seed => {
        if (seed.fresh || sessionStorage.getItem('e2e-seeded')) {
            return;
        }

        const toIso = day => {
            const [y, m, d] = day.split('-').map(Number);
            return new Date(y, m - 1, d).toISOString();
        };
        const transactions = seed.transactions.map(({ day, ...rest }) => ({ ...rest, date: toIso(day) }));
        localStorage.setItem('transactions', JSON.stringify(transactions));
        localStorage.setItem('settings', JSON.stringify(seed.settings));
        localStorage.setItem('balances', JSON.stringify(seed.balances));
        localStorage.setItem('closedMonths', JSON.stringify(seed.closedMonths));
        localStorage.setItem('registeredRoom', JSON.stringify(seed.registeredRoom));
        sessionStorage.setItem('e2e-seeded', '1');
    }, { settings: settings ?? makeSettings(), transactions, balances, closedMonths, registeredRoom, fresh });
    await page.goto('/');
}

export async function openTab(page, name) {
    await page.getByRole('tab', { name }).click();
    await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
}

export async function importFiles(page, files) {
    await page.locator('#csv-file').setInputFiles(files.map(([name, text]) => ({ name, mimeType: 'text/csv', buffer: Buffer.from(text) })));
    await page.locator('#import-btn').click();
    await expect(page.locator('#import-result-modal')).toBeVisible();
}

export const stored = (page, key) => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key);

export const monthHeader = (page, key) => page.locator(`#bs-grid th[data-month="${key}"]`);
export const balanceCell = (page, key, assetId) => page.locator(`#bs-grid td[data-month="${key}"][data-asset="${assetId}"]`);
export const gridRow = (page, label) => page.locator('#bs-grid tbody tr').filter({ has: page.locator('th[scope="row"]', { hasText: label }) });

// After the row header, a grid row has 12 month cells and then the extras.
export const monthCell = (row, monthIndex) => row.locator('td').nth(monthIndex);
export const extraCell = (row, name) => row.locator('td').nth({ total: 12, average: 13, prev: 14, diff: 15 }[name]);

export async function editBalance(page, key, assetId, value) {
    await balanceCell(page, key, assetId).dblclick();
    const input = balanceCell(page, key, assetId).locator('input');
    await input.fill(value);
    await input.press('Enter');
}
