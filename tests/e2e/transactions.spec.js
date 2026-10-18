import { test, expect } from '@playwright/test';
import { openApp, openTab, importFiles, makeSettings, tx, stored } from './helpers.js';

const AMEX_HEADER = 'Date,Date Processed,Description,Amount';

test('E1 — tabs show one panel at a time, Transactions first', async ({ page }) => {
    // Arrange
    await openApp(page);

    // Assert
    await expect(page.locator('#panel-transactions')).toBeVisible();
    await expect(page.locator('#panel-balance-sheet')).toBeHidden();
    await expect(page.locator('#panel-settings')).toBeHidden();

    // Arrange
    await openTab(page, 'Balance Sheet');

    // Assert
    await expect(page.locator('#panel-balance-sheet')).toBeVisible();
    await expect(page.locator('#panel-transactions')).toBeHidden();

    // Arrange
    await openTab(page, 'Settings');

    // Assert
    await expect(page.locator('#panel-settings')).toBeVisible();
    await expect(page.locator('#panel-balance-sheet')).toBeHidden();

    // Arrange
    await openTab(page, 'Transactions');

    // Assert
    await expect(page.locator('#panel-transactions')).toBeVisible();
});

test('E2 — import summary lists added transactions per month', async ({ page }) => {
    // Arrange
    await openApp(page, { transactions: [tx('2026-08-28', 'SENTINEL DUP', 12.5, 'expense', 'Casa', 'Amex')] });

    // Act
    await importFiles(page, [['amex.csv', [
        AMEX_HEADER,
        '28 Aug 2026,28 Aug 2026,SENTINEL DUP,12.50',
        '29 Aug 2026,29 Aug 2026,SENTINEL A,10.00',
        '01 Sep 2026,01 Sep 2026,SENTINEL B,20.00',
        '02 Sep 2026,02 Sep 2026,SENTINEL C,30.00',
        '03 Sep 2026,03 Sep 2026,PAYMENT RECEIVED - THANK YOU,-500.00'
    ].join('\n')]]);
    const dialog = page.locator('#import-result-modal');

    // Assert
    await expect(dialog).toContainText('Imported 3 transactions from 1 file:');
    await expect(dialog).toContainText('2026-08: 1 added');
    await expect(dialog).toContainText('2026-09: 2 added');
    await expect(dialog).toContainText('1 duplicate skipped · 1 matched the ignore list · 0 errors');

    // Act
    await page.locator('#import-result-ok').click();

    // Assert
    await expect(dialog).toBeHidden();
    await expect(page.locator('#transactions-body tr')).toHaveCount(4);
});

const BRADESCO = 'Data;Histórico;Docto.;Crédito (R$);Débito (R$);Saldo (R$)\n01/09/2026;SENTINEL MERCADO;1;;100,00;5,00';

test('E3 — Bradesco converts with the Settings BRL rate', async ({ page }) => {
    // Arrange
    await openApp(page, { settings: makeSettings({ rates: { BRL: 0.3 } }) });

    // Act
    await importFiles(page, [['bradesco.csv', BRADESCO]]);

    // Assert
    await expect(page.locator('#import-result-modal')).toContainText('Imported 1 transaction from 1 file:');
    expect((await stored(page, 'transactions'))[0].amount).toBeCloseTo(30);
});

test('E4 — Bradesco without a BRL rate imports nothing and says why', async ({ page }) => {
    // Arrange
    await openApp(page);

    // Act
    await importFiles(page, [['bradesco.csv', BRADESCO]]);
    const dialog = page.locator('#import-result-modal');

    // Assert
    await expect(dialog).toContainText('No transactions were imported from 1 file.');
    await expect(dialog).toContainText('bradesco.csv: Set the BRL → CAD rate in Settings before importing Bradesco files.');
    await expect(page.locator('#transactions-body tr')).toHaveCount(0);
});

test('E23 — fresh install starts empty and files imports under Sem Categoria', async ({ page }) => {
    // Arrange
    await openApp(page, { fresh: true });
    await openTab(page, 'Settings');

    // Assert
    await expect(page.locator('#category-chips-expense .chip')).toHaveText(['Sem Categoria']);
    await expect(page.locator('#category-chips-income .chip')).toHaveText(['Sem Categoria']);
    await expect(page.locator('#assets-body tr')).toHaveCount(0);
    await expect(page.locator('#rate-usd')).toHaveValue('');
    await expect(page.locator('#rate-brl')).toHaveValue('');

    // Arrange
    await openTab(page, 'Transactions');

    // Act
    await importFiles(page, [['td.csv', '09/02/2026,COSTCO WHOLESALE,12.50,,\n09/03/2026,PAYROLL DEPOSIT,,1000.00,']]);
    await page.locator('#import-result-ok').click();
    const categories = (await stored(page, 'transactions')).map(t => t.category);

    // Assert
    expect(categories).toEqual(['Sem Categoria', 'Sem Categoria']);
});

test('E24 — a category added from the transaction form appears everywhere', async ({ page }) => {
    // Arrange
    await openApp(page);

    // Act
    await page.locator('#add-transaction-btn').click();
    await page.locator('#transaction-description').fill('SENTINEL VET');
    await page.locator('#transaction-amount').fill('80');
    await page.locator('#transaction-category').selectOption('new');
    await page.locator('#new-category-name').fill('Pets');
    await page.getByRole('button', { name: 'Save Transaction' }).click();

    // Assert
    await expect(page.locator('#category-select option', { hasText: 'Pets' })).toHaveCount(1);
    await expect(page.locator('#transactions-body .category-edit-dropdown')).toHaveValue('Pets');

    // Act
    await openTab(page, 'Settings');

    // Assert
    await expect(page.locator('#category-chips-expense .chip[data-name="Pets"]')).toBeVisible();
});

test('E29 — re-importing an export adds only the categories of rows it keeps', async ({ page }) => {
    // Arrange
    await openApp(page, { transactions: [tx('2026-09-01', 'SENTINEL VET', 80, 'expense', 'Casa')] });
    const csv = [
        'Date,Description,Category,Account,Amount,Type',
        '2026-09-01,SENTINEL VET,Ghost,TD,80,expense',
        '2026-09-02,PAYMENT RECEIVED - THANK YOU,Transfers,TD,50,income',
        '2026-09-03,SENTINEL GROOMER,Pets,TD,40,expense'
    ].join('\n');

    // Act
    await importFiles(page, [['export.csv', csv]]);

    // Assert
    await expect(page.locator('#import-result-body')).toContainText('1 duplicate skipped · 1 matched the ignore list');
    const { categories } = await stored(page, 'settings');
    expect(categories.expense).toContain('Pets');
    expect(categories.expense).not.toContain('Ghost');
    expect(categories.income).not.toContain('Transfers');
});

test('v4 E29 — Select Year shows a year selector and filters to the chosen year', async ({ page }) => {
    // Arrange
    await openApp(page, {
        transactions: [
            tx('2024-03-01', 'Older rent', 100, 'expense', 'Casa'),
            tx('2025-01-01', 'New year rent', 200, 'expense', 'Casa'),
            tx('2025-12-31', 'Year end pay', 1000, 'income', 'Trabalho')
        ]
    });
    const descriptions = page.locator('#transactions-body td[data-field="description"]');

    // Act
    await page.locator('#date-range').selectOption('year');

    // Assert
    await expect(page.locator('#year-filter')).toBeVisible();
    await expect(page.locator('#year-filter option')).toHaveText(['2025', '2024']);
    await expect(descriptions).toHaveText(['New year rent', 'Year end pay']);
    await expect(page.locator('#total-expenses')).toHaveText('$200.00');

    // Act
    await page.locator('#year-filter').selectOption('2024');

    // Assert
    await expect(descriptions).toHaveText(['Older rent']);
    await expect(page.locator('#total-income')).toHaveText('$0.00');

    // Act
    await page.locator('#date-range').selectOption('all');

    // Assert
    await expect(page.locator('#year-filter')).toBeHidden();
    await expect(descriptions).toHaveCount(3);
});
