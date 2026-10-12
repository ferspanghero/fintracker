import { test, expect } from '@playwright/test';
import {
    openApp, openTab, makeSettings, tx, stored, monthHeader, balanceCell, gridRow, monthCell, extraCell, editBalance
} from './helpers.js';

const SEP = 8;

test('E5 — entering a balance updates net worth in CAD', async ({ page }) => {
    // Arrange
    await openApp(page, { settings: makeSettings({ assets: [['usd', 'Sentinel Brokerage', 'USD']], rates: { USD: 1.5 } }) });
    await openTab(page, 'Balance Sheet');

    // Act
    await editBalance(page, '2026-09', 'usd', '100');

    // Assert
    await expect(balanceCell(page, '2026-09', 'usd')).toHaveText('100');
    await expect(monthCell(gridRow(page, 'Net worth'), SEP)).toHaveText('$150');
    expect(await stored(page, 'balances')).toEqual({ '2026-09': { usd: 100 } });
});

test('E6 — clearing the only balance blanks the month', async ({ page }) => {
    // Arrange
    await openApp(page, { settings: makeSettings({ assets: [['a', 'Sentinel Savings', 'CAD']] }), balances: { '2026-09': { a: 5 } } });
    await openTab(page, 'Balance Sheet');

    // Act
    await editBalance(page, '2026-09', 'a', '');

    // Assert
    await expect(balanceCell(page, '2026-09', 'a')).toHaveText('·');
    await expect(monthCell(gridRow(page, 'Net worth'), SEP)).toHaveText('');
    expect(await stored(page, 'balances')).toEqual({});
});

test('E7 — invalid input shows a message and keeps the value', async ({ page }) => {
    // Arrange
    await openApp(page, { settings: makeSettings({ assets: [['a', 'Sentinel Savings', 'CAD']] }), balances: { '2026-09': { a: 5 } } });
    await openTab(page, 'Balance Sheet');

    // Act
    await editBalance(page, '2026-09', 'a', 'abc');

    // Assert
    await expect(page.locator('#bs-message')).toHaveText('Enter a number, or leave it blank to clear.');
    await expect(balanceCell(page, '2026-09', 'a')).toHaveText('5');
});

test('E8 — Copy prev. copies active assets only', async ({ page }) => {
    // Arrange
    await openApp(page, {
        settings: makeSettings({ assets: [['a', 'Sentinel A', 'CAD'], ['b', 'Sentinel B', 'USD'], ['old', 'Sentinel Old', 'CAD', true]], rates: { USD: 1.5 } }),
        balances: { '2026-08': { a: 10, b: 20, old: 30 } }
    });
    await openTab(page, 'Balance Sheet');

    // Act
    await monthHeader(page, '2026-09').getByRole('button', { name: 'Copy prev.' }).click();

    // Assert
    await expect(balanceCell(page, '2026-09', 'a')).toHaveText('10');
    await expect(balanceCell(page, '2026-09', 'b')).toHaveText('20');
    await expect(balanceCell(page, '2026-09', 'old')).toHaveText('·');
});

test('E9 — closing a month marks it and counts it in Average; reopening reverts', async ({ page }) => {
    // Arrange
    await openApp(page, {
        settings: makeSettings({ assets: [['a', 'Sentinel Savings', 'CAD']] }),
        balances: { '2026-09': { a: 5 } },
        transactions: [tx('2026-09-10', 'Rent', 100, 'expense', 'Casa')]
    });
    await openTab(page, 'Balance Sheet');
    const header = monthHeader(page, '2026-09');
    const totalExpenses = gridRow(page, 'Total expenses');

    // Assert
    await expect(extraCell(totalExpenses, 'average')).toHaveText('—');

    // Act
    await header.getByRole('button', { name: 'Close' }).click();

    // Assert
    await expect(header).toContainText('✓ Closed');
    await expect(header).toHaveClass(/closed/);
    await expect(extraCell(totalExpenses, 'average')).toHaveText('100.00');
    expect(await stored(page, 'closedMonths')).toEqual(['2026-09']);

    // Act
    await header.getByRole('button', { name: 'Reopen' }).click();

    // Assert
    await expect(header).toContainText('Open');
    await expect(extraCell(totalExpenses, 'average')).toHaveText('—');
});

test('E10 — Average and Diff % use closed months against last year', async ({ page }) => {
    // Arrange
    await openApp(page, {
        transactions: [
            tx('2026-01-05', 'Rent', 100, 'expense', 'Casa'),
            tx('2026-02-05', 'Rent', 200, 'expense', 'Casa'),
            tx('2025-01-05', 'Rent', 100, 'expense', 'Casa')
        ],
        closedMonths: ['2025-01', '2026-01', '2026-02']
    });
    await openTab(page, 'Balance Sheet');
    const total = gridRow(page, 'Total expenses');

    // Assert
    await expect(extraCell(total, 'average')).toHaveText('150.00');
    await expect(extraCell(total, 'prev')).toHaveText('100.00');
    await expect(extraCell(total, 'diff')).toHaveText('+50.0%');
    await expect(page.locator('#bs-indicators')).toContainText('Expense change vs last year +50.0%');
});

test('E12 — Sem Categoria is highlighted when it has spending', async ({ page }) => {
    // Arrange
    await openApp(page, { transactions: [tx('2026-09-03', 'SENTINEL ?', 9, 'expense', 'Sem Categoria')] });
    await openTab(page, 'Balance Sheet');

    // Assert
    await expect(gridRow(page, 'Sem Categoria')).toHaveClass(/warn/);
    await expect(gridRow(page, 'Casa')).not.toHaveClass(/warn/);
});

test('E13 — an archived asset shows only in years it had a balance', async ({ page }) => {
    // Arrange
    await openApp(page, {
        settings: makeSettings({ assets: [['old', 'Sentinel Old', 'CAD', true], ['a', 'Sentinel Active', 'CAD']] }),
        balances: { '2025-06': { old: 50 } }
    });
    await openTab(page, 'Balance Sheet');

    // Assert
    await expect(gridRow(page, 'Sentinel Old')).toHaveCount(0);
    await expect(gridRow(page, 'Sentinel Active')).toHaveCount(1);

    // Act
    await page.locator('#bs-year').selectOption('2025');

    // Assert
    await expect(gridRow(page, 'Sentinel Old')).toHaveCount(1);
    await expect(gridRow(page, 'Sentinel Old')).toContainText('archived');
    await expect(gridRow(page, 'Sentinel Active')).toHaveCount(0);
});

test('E14 — indicators', async ({ page }) => {
    // Arrange
    await openApp(page, {
        settings: makeSettings({ assets: [['a', 'Sentinel Savings', 'CAD']] }),
        balances: { '2025-12': { a: 1000 }, '2026-04': { a: 1200 } },
        transactions: [tx('2026-01-05', 'Pay', 500, 'income', 'Trabalho'), tx('2026-02-05', 'Rent', 200, 'expense', 'Casa')]
    });
    await openTab(page, 'Balance Sheet');
    const indicators = page.locator('#bs-indicators');

    // Assert
    await expect(page.locator('#bs-indicators-title')).toHaveText('Indicators 2026');
    await expect(indicators).toContainText('Net worth at start of year $1,000');
    await expect(indicators).toContainText('Current net worth $1,200');
    await expect(indicators).toContainText('Net worth change $200 (+20.0%)');
    await expect(indicators).toContainText('Total saved $300');
    await expect(indicators).toContainText('Investment returns -$100');
    await expect(indicators).toContainText('Saving rate 60.0%');
});

test('E25 — a missing rate shows a dash and points to Settings', async ({ page }) => {
    // Arrange
    await openApp(page, { settings: makeSettings({ assets: [['usd', 'Sentinel Brokerage', 'USD']] }), balances: { '2026-09': { usd: 10 } } });
    await openTab(page, 'Balance Sheet');

    // Assert
    await expect(monthCell(gridRow(page, 'Net worth'), SEP)).toHaveText('—');
    await expect(page.locator('#bs-rate-note')).toHaveText('Set rates in Settings: USD.');
});

test('E26 — one click saves the balance being edited and runs the month action', async ({ page }) => {
    // Arrange
    await openApp(page, { settings: makeSettings({ assets: [['a', 'Sentinel Savings', 'CAD']] }), balances: { '2026-09': { a: 5 } } });
    await openTab(page, 'Balance Sheet');
    await balanceCell(page, '2026-09', 'a').dblclick();
    await balanceCell(page, '2026-09', 'a').locator('input').fill('7');

    // Act
    await monthHeader(page, '2026-09').getByRole('button', { name: 'Close' }).click();

    // Assert
    await expect(monthHeader(page, '2026-09')).toContainText('✓ Closed');
    await expect(balanceCell(page, '2026-09', 'a')).toHaveText('7');
    expect(await stored(page, 'balances')).toEqual({ '2026-09': { a: 7 } });
    expect(await stored(page, 'closedMonths')).toEqual(['2026-09']);
});

async function openTwoAssetGrid(page) {
    const assets = [['a', 'Sentinel Savings', 'CAD'], ['b', 'Sentinel Brokerage', 'CAD']];
    await openApp(page, { settings: makeSettings({ assets }), balances: { '2026-09': { a: 5, b: 1 } } });
    await openTab(page, 'Balance Sheet');
}

test('E27 — a click selects a balance; typing replaces it and Enter saves and moves down', async ({ page }) => {
    // Arrange
    await openTwoAssetGrid(page);
    await balanceCell(page, '2026-09', 'a').click();
    const editorsAfterClick = await balanceCell(page, '2026-09', 'a').locator('input').count();

    // Act
    await page.keyboard.type('12');
    await page.keyboard.press('Enter');

    // Assert
    expect(editorsAfterClick).toBe(0);
    await expect(balanceCell(page, '2026-09', 'a')).toHaveText('12');
    await expect(balanceCell(page, '2026-09', 'b')).toBeFocused();
    expect(await stored(page, 'balances')).toEqual({ '2026-09': { a: 12, b: 1 } });
});

test('E30 — arrows move the selection; Tab and Shift+Tab save and move sideways', async ({ page }) => {
    // Arrange
    await openTwoAssetGrid(page);
    await balanceCell(page, '2026-09', 'b').click();

    // Act
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.type('3');
    await page.keyboard.press('Tab');
    await page.keyboard.type('4');
    await page.keyboard.press('Shift+Tab');

    // Assert
    await expect(balanceCell(page, '2026-10', 'a')).toBeFocused();
    expect(await stored(page, 'balances')).toEqual({ '2026-09': { a: 5, b: 1 }, '2026-10': { a: 3 }, '2026-11': { a: 4 } });
});

test('E31 — Delete clears a balance; F2 edits the current value and Escape cancels', async ({ page }) => {
    // Arrange
    await openTwoAssetGrid(page);
    await balanceCell(page, '2026-09', 'b').click();

    // Act
    await page.keyboard.press('Delete');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('F2');
    await page.keyboard.type('9');
    await page.keyboard.press('Escape');
    await page.keyboard.press('F2');
    await page.keyboard.type('0');
    await page.keyboard.press('Enter');

    // Assert
    await expect(balanceCell(page, '2026-09', 'b')).toHaveText('·');
    await expect(balanceCell(page, '2026-09', 'a')).toHaveText('50');
    expect(await stored(page, 'balances')).toEqual({ '2026-09': { a: 50 } });
});

test('E32 — on a narrow screen the selected cell scrolls clear of the sticky first column', async ({ page }) => {
    // Arrange
    await page.setViewportSize({ width: 390, height: 800 });
    await openTwoAssetGrid(page);
    await balanceCell(page, '2026-12', 'a').click();

    // Act
    for (let i = 0; i < 11; i++) {
        await page.keyboard.press('ArrowLeft');
    }

    // Assert
    await expect(balanceCell(page, '2026-01', 'a')).toBeFocused();
    const stickyRight = await gridRow(page, 'Sentinel Savings').locator('th').evaluate(th => th.getBoundingClientRect().right);
    const cellLeft = await balanceCell(page, '2026-01', 'a').evaluate(td => td.getBoundingClientRect().left);
    expect(cellLeft).toBeGreaterThanOrEqual(stickyRight - 1);
});
