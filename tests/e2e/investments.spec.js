// v4 scenarios for the Investments & FIRE tab. All data is synthetic.
import { test, expect } from '@playwright/test';
import { openApp, openTab, tx, stored, SAMPLE_CATEGORIES } from './helpers.js';

const asset = (id, type, institution, owner, holding, currency = 'CAD') => ({
    id, name: [[type, institution].filter(Boolean).join(' '), owner, holding].filter(Boolean).join(' - '),
    currency, archived: false, type, institution, owner, holding
});

function fireSettings({ fire = {}, holdings, targets = {}, assets, rates = { USD: 1.5 } } = {}) {
    return {
        version: 2,
        rates: { USD: null, BRL: null, date: null, refreshedAt: null, ...rates },
        categories: structuredClone(SAMPLE_CATEGORIES),
        assets: assets ?? [
            asset('eq', 'Non-registered', 'Broker', 'Joint', 'ETF1'),
            asset('rrsp', 'RRSP', 'Broker', 'Alex', 'ETF2', 'USD'),
            asset('tfsa', 'TFSA', 'Broker', 'Sam', 'ETF1'),
            asset('cash', 'Savings', 'Bank', 'Joint', 'Cash')
        ],
        holdings: holdings ?? [{ name: 'ETF1', split: { usEquity: 100 } }, { name: 'Cash', split: { cash: 100 } }],
        targets,
        fire: {
            swr: 4, withdrawalTax: 20, retirementSpending: null, expectedReturn: 7, inflation: 2,
            nonRegTaxDrag: 10, birthYear: 1990, projectionStart: 2025, projectionEnd: 2033, ...fire
        }
    };
}

// Twelve months up to Sep 2026: 10,000 in and 5,000 out each, so 60,000 spent and saved.
const lastYear = () => Array.from({ length: 12 }, (_, i) => {
    const date = new Date(2025, 9 + i, 5);
    const day = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-05`;

    return [tx(day, 'Pay', 10000, 'income', 'Trabalho'), tx(day, 'Rent', 5000, 'expense', 'Casa')];
}).flat();

const LATEST = { '2026-09': { eq: 600000, rrsp: 200000, tfsa: 300000, cash: 50000 } };

async function openFire(page, { settings = fireSettings(), transactions = lastYear(), balances = LATEST, closedMonths = [], registeredRoom = [] } = {}) {
    await openApp(page, { settings, transactions, balances: structuredClone(balances), closedMonths, registeredRoom });
    await openTab(page, 'Investments & FIRE');
}

// A term found by its visible label (its balloon text follows the label).
const term = (page, scope, label) => page.locator(`${scope} .tip`, { hasText: new RegExp(`^${label}`) });
const stat = (page, label) => page.locator('#fire-stats .kpi').filter({ has: term(page, '.k', label) }).locator('.v');
const yearRow = (page, year) => page.locator(`#fire-projection tr[data-year="${year}"]`);
const allocationRow = (page, label) => page.locator('#fire-allocation tbody tr').filter({ has: page.locator('th', { hasText: label }) });
const roomInput = (page, account, person, field) =>
    page.locator(`#fire-room input[data-account="${account}"][data-person="${person}"][data-field="${field}"]`);
const roomLeft = (page, person) => page.locator(`#fire-room tr[data-person="${person}"] .left`);

test('v4 E1 — without balances the tab asks for them', async ({ page }) => {
    // Arrange, Act
    await openFire(page, { balances: {} });

    // Assert
    await expect(page.locator('#fire-empty')).toHaveText('Enter balances on the Balance Sheet to see where you stand.');
    await expect(page.locator('#fire-content')).toBeHidden();
});

test('v4 E2/E3 — where you stand and progress come from the latest month and last 12 months', async ({ page }) => {
    // Arrange, Act
    await openFire(page);

    // Assert
    await expect(page.locator('#fire-stand-title')).toHaveText('Where you stand — balances as of Sep 2026');
    await expect(stat(page, 'FI portfolio')).toHaveText('$1,200,000');
    await expect(stat(page, 'FI number')).toHaveText('$1,875,000');
    await expect(stat(page, 'SWR today')).toHaveText('6.25%');
    await expect(page.locator('#fire-progress [role="progressbar"]')).toHaveAttribute('aria-valuenow', '64');
    await expect(page.locator('#fire-progress .fire-figures')).toContainText('64.0%');
    await expect(page.locator('#fire-progress .fire-figures')).toContainText('233 of 365');
    await expect(page.locator('#fire-progress .fire-figures')).toContainText('Jan 1 → Aug 21 paid for · Aug 22 → Dec 31 needs $675,000 more');
});

test('v4 E4 — a retirement spending override set in Settings drives the FI number', async ({ page }) => {
    // Arrange
    await openApp(page, { settings: fireSettings(), transactions: lastYear(), balances: LATEST });
    await openTab(page, 'Settings');

    // Assert
    await expect(page.locator('[data-fire="retirementSpending"]')).toHaveAttribute('placeholder', '60,000');

    // Act
    await page.locator('[data-fire="retirementSpending"]').fill('40000');
    await page.locator('[data-fire="retirementSpending"]').press('Tab');
    await openTab(page, 'Investments & FIRE');

    // Assert
    await expect(stat(page, 'FI number')).toHaveText('$1,250,000');
    await expect(page.locator('#fire-assumptions')).toContainText('$40,000 (your amount)');

    // Act
    await openTab(page, 'Settings');
    await page.locator('[data-fire="retirementSpending"]').fill('');
    await page.locator('[data-fire="retirementSpending"]').press('Tab');
    await openTab(page, 'Investments & FIRE');

    // Assert
    await expect(stat(page, 'FI number')).toHaveText('$1,875,000');
    await expect(page.locator('#fire-assumptions dd.default').first()).toHaveText('$60,000 (last 12 months)');
});

test('v4 E5/E6 — the projection runs from start to end year and badges the FI year', async ({ page }) => {
    // Arrange, Act
    await openFire(page, { settings: fireSettings({ fire: { projectionStart: 2017, projectionEnd: 2037 } }) });

    // Assert
    await expect(page.locator('#fire-projection tbody tr')).toHaveCount(21);
    await expect(yearRow(page, 2017)).toHaveClass('none');
    await expect(yearRow(page, 2017).locator('td').nth(1)).toHaveText('—');
    await expect(yearRow(page, 2026)).toHaveClass('open');
    await expect(yearRow(page, 2026).locator('td').nth(1)).toHaveText('$1,200,000 Sep');
    await expect(yearRow(page, 2027)).toHaveClass('projected');
    await expect(yearRow(page, 2037)).toHaveCount(1);
    await expect(page.locator('#fire-projection .fi-badge')).toHaveCount(1);
    await expect(yearRow(page, 2032).locator('.fi-badge')).toBeVisible();
    await expect(stat(page, 'FI year')).toHaveText('2032');
});

test('v4 E7/E8 — closed Decembers are actual years; an unclosed past December has no data', async ({ page }) => {
    // Arrange
    const balances = { ...LATEST, '2023-12': { eq: 700000 }, '2024-12': { eq: 800000 }, '2025-12': { eq: 1000000 } };
    const transactions = [...lastYear(), tx('2025-01-05', 'Bonus', 30000, 'income', 'Trabalho')];

    // Act
    await openFire(page, { balances, transactions, closedMonths: ['2024-12', '2025-12'], settings: fireSettings({ fire: { projectionStart: 2023 } }) });

    // Assert
    await expect(yearRow(page, 2023)).toHaveClass('none');
    await expect(yearRow(page, 2024)).toHaveClass('actual');
    await expect(yearRow(page, 2024).locator('td')).toHaveText(['34', '—', '—', '—', '$800,000', '9.38%']);
    await expect(yearRow(page, 2025)).toHaveClass('actual');
    await expect(yearRow(page, 2025).locator('td')).toHaveText(['35', '$800,000', '+$200,000', '—', '$1,000,000', '7.50%']);
    await expect(yearRow(page, 2025).locator('th .state')).toHaveText('Actual');
});

test('v4 E9 — a closed December as the latest month starts the projection the next year', async ({ page }) => {
    // Arrange
    const transactions = lastYear().map(t => ({ ...t, day: t.day.replace('2026-', '2025-').replace(/^2025-(1[0-2])/, '2024-$1') }));

    // Act
    await openFire(page, { balances: { '2025-12': { eq: 1200000 } }, closedMonths: ['2025-12'], transactions });

    // Assert
    await expect(yearRow(page, 2025)).toHaveClass('actual');
    await expect(yearRow(page, 2026)).toHaveClass('projected');
    await expect(yearRow(page, 2026).locator('td').nth(1)).toHaveText('$1,200,000');
});

test('v4 E10 — a portfolio above the FI number has reached FI', async ({ page }) => {
    // Arrange, Act
    await openFire(page, { balances: { '2026-09': { eq: 5000000 } } });

    // Assert
    await expect(stat(page, 'FI year')).toHaveText('Reached');
    await expect(page.locator('#fire-progress [role="progressbar"]')).toHaveAttribute('aria-valuenow', '100');
    await expect(page.locator('#fire-progress')).toContainText('Jan 1 → Dec 31 paid for');
});

test('v4 E11 — FI out of reach by the end year says so', async ({ page }) => {
    // Arrange, Act
    await openFire(page, { balances: { '2026-09': { cash: 1000 } }, settings: fireSettings({ fire: { projectionEnd: 2037 } }) });

    // Assert
    await expect(stat(page, 'FI year')).toHaveText('Not reached by 2037');
});

test('v4 E12 — without spending there is no FI number or projection', async ({ page }) => {
    // Arrange, Act
    await openFire(page, { transactions: [] });

    // Assert
    await expect(stat(page, 'FI number')).toHaveText('—');
    await expect(page.locator('#fire-progress')).toHaveText('No FI number yet: add spending, or set a fixed amount in Settings.');
    await expect(page.locator('#fire-projection tr')).toHaveCount(0);
});

test('v4 E13 — a missing rate is asked for instead of showing figures', async ({ page }) => {
    // Arrange, Act
    await openFire(page, { settings: fireSettings({ rates: { USD: null } }) });

    // Assert
    await expect(page.locator('#fire-rate-note')).toHaveText('Set the USD rate in Settings to see where you stand.');
    await expect(page.locator('#fire-content')).toBeHidden();
});

test('v4 E14/E15 — allocation spreads splits and shows drift from targets', async ({ page }) => {
    // Arrange
    const settings = fireSettings({
        holdings: [{ name: 'ETF1', split: { usEquity: 60, intlEquity: 30, emEquity: 10 } }, { name: 'ETF2', split: { canadaEquity: 100 } }, { name: 'Cash', split: { cash: 100 } }],
        targets: { canadaEquity: 30, usEquity: 50, intlEquity: 10, emEquity: 10, fixedIncome: 0 }
    });

    // Act
    await openFire(page, { settings, balances: { '2026-09': { eq: 100000, rrsp: 0, tfsa: 0 } } });

    // Assert
    await expect(allocationRow(page, 'US Equity').locator('td').nth(0)).toHaveText('$60,000');
    await expect(allocationRow(page, 'Intl Equity').locator('td').nth(0)).toHaveText('$30,000');
    await expect(allocationRow(page, 'Emerging Markets Equity').locator('td').nth(0)).toHaveText('$10,000');
    await expect(allocationRow(page, 'US Equity').locator('td').nth(3)).toHaveText('+10.0%');
    await expect(allocationRow(page, 'US Equity').locator('td').nth(4)).toHaveText('sell $10,000');
    await expect(allocationRow(page, 'Canada Equity').locator('td').nth(4)).toHaveText('buy $30,000');
    await expect(allocationRow(page, 'Intl Equity').locator('td').nth(4)).toHaveText('sell $20,000');
    await expect(allocationRow(page, 'Emerging Markets Equity').locator('td').nth(4)).toHaveText('on target');
    await expect(allocationRow(page, 'Cash').locator('td')).toHaveText(['$0', '—', '—', '—', '—', '']);
    await expect(allocationRow(page, 'Fixed Income / Bonds').locator('td').nth(2)).toHaveText('0.0%');
});

test('v4 E16 — assets without a split are Unclassified but still count toward FI', async ({ page }) => {
    // Arrange, Act
    await openFire(page);

    // Assert
    await expect(allocationRow(page, 'Unclassified').locator('td').first()).toHaveText('$300,000');
    await expect(page.locator('#fire-holdings tbody tr').filter({ hasText: 'ETF2' }).locator('td').nth(1)).toHaveText('Unclassified');
    await expect(page.locator('#fire-warning')).toContainText('1 asset has no class split');
    await expect(stat(page, 'FI portfolio')).toHaveText('$1,200,000');
});

test('v4 E20/E21 — room shows what is left and warns past the limits', async ({ page }) => {
    // Arrange
    await openFire(page);

    // Act
    await roomInput(page, 'RRSP', 'Alex', 'room').fill('30000');
    await roomInput(page, 'RRSP', 'Alex', 'room').press('Tab');

    // Assert
    await expect(roomInput(page, 'RRSP', 'Alex', 'contributed')).toBeFocused();

    // Act
    await roomInput(page, 'RRSP', 'Alex', 'contributed').fill('24000');
    await roomInput(page, 'RRSP', 'Alex', 'contributed').press('Tab');

    // Assert
    await expect(roomLeft(page, 'Alex')).toHaveText('$6,000');
    await expect(roomInput(page, 'RRSP', 'Alex', 'room')).toHaveValue('30,000');

    // Act
    await roomInput(page, 'RRSP', 'Alex', 'contributed').fill('31500');
    await roomInput(page, 'RRSP', 'Alex', 'contributed').press('Tab');

    // Assert
    await expect(roomLeft(page, 'Alex')).toHaveText('over by $1,500');

    // Act
    await roomInput(page, 'RRSP', 'Alex', 'contributed').fill('33000');
    await roomInput(page, 'RRSP', 'Alex', 'contributed').press('Tab');
    await roomInput(page, 'TFSA', 'Sam', 'room').fill('1000');
    await roomInput(page, 'TFSA', 'Sam', 'room').press('Tab');
    await roomInput(page, 'TFSA', 'Sam', 'contributed').fill('1100');
    await roomInput(page, 'TFSA', 'Sam', 'contributed').press('Tab');

    // Assert
    await expect(roomLeft(page, 'Alex')).toHaveText('over by $3,000 — past the $2,000 allowance, CRA charges 1% a month');
    await expect(roomLeft(page, 'Sam')).toHaveText('over by $100 — CRA charges 1% a month');
});

test('v4 E22 — room rows come from RRSP and TFSA owners, not Joint, and persist', async ({ page }) => {
    // Arrange
    await openFire(page);

    // Act
    await roomInput(page, 'TFSA', 'Sam', 'room').fill('7000');
    await roomInput(page, 'TFSA', 'Sam', 'room').press('Tab');
    await page.reload();
    await openTab(page, 'Investments & FIRE');

    // Assert
    await expect(page.locator('#fire-room tbody tr')).toHaveCount(2);
    await expect(page.locator('#fire-room tr[data-person="Joint"]')).toHaveCount(0);
    await expect(roomInput(page, 'TFSA', 'Sam', 'room')).toHaveValue('7,000');
    expect(await stored(page, 'registeredRoom')).toEqual([{ year: 2026, account: 'TFSA', person: 'Sam', room: 7000, contributed: null }]);
});

test('v4 E23 — a term explains itself after a hover, at once on focus, and Escape hides it', async ({ page }) => {
    // Arrange
    await openFire(page);
    const fiNumber = term(page, '#fire-stats', 'FI number');
    const balloon = fiNumber.locator('[role="tooltip"]');

    // Act
    await fiNumber.hover();

    // Assert
    await expect(balloon).toBeHidden();
    await expect(balloon).toBeVisible({ timeout: 3000 });

    // Act
    await page.keyboard.press('Escape');

    // Assert
    await expect(balloon).toBeHidden();

    // Act
    await page.mouse.move(0, 0);
    await term(page, '#fire-stats', 'SWR today').focus();
    await page.keyboard.press('Shift+Tab');

    // Assert
    await expect(fiNumber).toBeFocused();
    await expect(balloon).toBeVisible();
    await expect(fiNumber).toHaveAttribute('aria-describedby', await balloon.getAttribute('id'));

    // Act
    await page.keyboard.press('Escape');
    const swr = term(page, '#fire-stats', 'SWR today');
    await swr.click();

    // Assert
    await expect(swr.locator('[role="tooltip"]')).toBeVisible();
});

test('v4 E27 — the non-registered share is computed from the account types', async ({ page }) => {
    // Arrange, Act
    await openFire(page);

    // Assert
    await expect(page.locator('#fire-assumptions')).toContainText('50% (computed)');
});
