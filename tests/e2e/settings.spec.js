import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openApp, openTab, makeSettings, tx, stored, gridRow, monthCell } from './helpers.js';

const BOC_ROUTE = '**/valet/observations/**';
const chip = (page, type, name) => page.locator(`#category-chips-${type} .chip[data-name="${name}"]`);

async function restoreFile(page, name, content) {
    await page.locator('#restore-file').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(content) });
}

async function allData(page) {
    return page.evaluate(() => ['transactions', 'settings', 'balances', 'closedMonths', 'registeredRoom'].map(k => localStorage.getItem(k)));
}

test('E11 — a category added in Settings gets a Balance Sheet row and a filter option', async ({ page }) => {
    // Arrange
    await openApp(page);
    await openTab(page, 'Settings');

    // Act
    await page.locator('#settings-new-category').fill('Pets');
    await page.locator('#add-category-btn').click();

    // Assert
    await expect(chip(page, 'expense', 'Pets')).toBeVisible();

    // Act
    await openTab(page, 'Balance Sheet');

    // Assert
    await expect(gridRow(page, 'Pets')).toHaveCount(1);

    // Act
    await openTab(page, 'Transactions');

    // Assert
    await expect(page.locator('#category-select optgroup[label="Expenses"] option', { hasText: 'Pets' })).toHaveCount(1);
});

test('E15 — Refresh Rates pulls the latest Bank of Canada rates', async ({ page }) => {
    // Arrange
    await page.route(BOC_ROUTE, route => route.fulfill({
        json: { observations: [{ d: '2026-10-09', FXUSDCAD: { v: '1.4000' }, FXBRLCAD: { v: '0.2700' } }] }
    }));
    await openApp(page);
    await openTab(page, 'Settings');

    // Act
    await page.getByRole('button', { name: 'Refresh Rates' }).click();

    // Assert
    await expect(page.locator('#rate-usd')).toHaveValue('1.4');
    await expect(page.locator('#rate-brl')).toHaveValue('0.27');
    await expect(page.locator('#rate-note')).toContainText('Bank of Canada rate for 2026-10-09');
    expect((await stored(page, 'settings')).rates).toMatchObject({ USD: 1.4, BRL: 0.27, date: '2026-10-09' });
});

test('E16 — a failed refresh leaves rates unchanged', async ({ page }) => {
    // Arrange
    await page.route(BOC_ROUTE, route => route.abort());
    await openApp(page, { settings: makeSettings({ rates: { USD: 1.3, BRL: 0.25 } }) });
    await openTab(page, 'Settings');

    // Act
    await page.getByRole('button', { name: 'Refresh Rates' }).click();

    // Assert
    await expect(page.locator('#rate-message')).toHaveText("Couldn't reach the Bank of Canada. Rates unchanged.");
    await expect(page.locator('#rate-usd')).toHaveValue('1.3');
    await expect(page.locator('#rate-brl')).toHaveValue('0.25');
    await expect(page.getByRole('button', { name: 'Refresh Rates' })).toBeEnabled();
});

test('E17 — a category in use cannot be removed; an unused one is removed everywhere', async ({ page }) => {
    // Arrange
    await openApp(page, { transactions: [1, 2, 3].map(i => tx(`2026-09-0${i}`, `Rent ${i}`, 10, 'expense', 'Casa')) });
    await openTab(page, 'Settings');
    const casaRemove = chip(page, 'expense', 'Casa').getByRole('button');

    // Assert
    await expect(casaRemove).toBeDisabled();
    await expect(casaRemove).toHaveAttribute('title', 'Used by 3 transactions');

    // Act
    await chip(page, 'expense', 'Lazer').getByRole('button').click();

    // Assert
    await expect(chip(page, 'expense', 'Lazer')).toHaveCount(0);

    // Act
    await openTab(page, 'Transactions');

    // Assert
    await expect(page.locator('#category-select option', { hasText: 'Lazer' })).toHaveCount(0);
});

test('E18 — duplicate category and asset names are refused', async ({ page }) => {
    // Arrange
    await openApp(page, { settings: makeSettings({ assets: [['a', 'Sentinel Savings', 'CAD']] }) });
    await openTab(page, 'Settings');

    // Act
    await page.locator('#settings-new-category').fill('casa');
    await page.locator('#add-category-btn').click();
    await page.locator('#new-asset-name').fill('SENTINEL SAVINGS');
    await page.locator('#add-asset-btn').click();

    // Assert
    await expect(page.locator('#category-message')).toHaveText('"Casa" already exists.');
    await expect(page.locator('#asset-message')).toHaveText('"Sentinel Savings" already exists.');
    await expect(page.locator('#category-chips-expense .chip')).toHaveCount(6);
    await expect(page.locator('#assets-body tr')).toHaveCount(1);
});

test('E19 — changing an asset currency revalues its balances', async ({ page }) => {
    // Arrange
    await openApp(page, {
        settings: makeSettings({ assets: [['a', 'Sentinel Savings', 'CAD']], rates: { USD: 1.5 } }),
        balances: { '2026-09': { a: 100 } }
    });
    await openTab(page, 'Settings');

    // Act
    await page.locator('#assets-body tr').first().locator('[data-field="currency"]').selectOption('USD');
    await openTab(page, 'Balance Sheet');

    // Assert
    await expect(monthCell(gridRow(page, 'Net worth'), 8)).toHaveText('$150');
});

const SEEDED = {
    settings: makeSettings({ assets: [['a', 'Sentinel Savings', 'CAD'], ['u', 'Sentinel Brokerage', 'USD', true]], rates: { USD: 1.4, BRL: 0.28 } }),
    transactions: [tx('2026-08-03', 'Rent', 1500, 'expense', 'Casa'), tx('2026-08-04', 'Pay', 4000, 'income', 'Trabalho')],
    balances: { '2026-08': { a: 100.25, u: -3 } },
    closedMonths: ['2026-08']
};

test('E20 — Backup then Restore brings back identical data', async ({ page }) => {
    // Arrange
    await openApp(page, SEEDED);
    const before = await allData(page);
    await openTab(page, 'Settings');

    // Act
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Backup' }).click();
    const download = await downloadPromise;

    // Assert
    expect(download.suggestedFilename()).toBe('fintracker-backup-2026-10-11.json');

    // Act
    const content = await readFile(await download.path(), 'utf8');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await openTab(page, 'Settings');

    // Assert
    await expect(page.locator('#assets-body tr')).toHaveCount(0);

    // Act
    await restoreFile(page, 'backup.json', content);

    // Assert
    await expect(page.locator('#restore-summary')).toHaveText('2 transactions, 2 assets, 1 month of balances. This replaces all current data.');

    // Act
    await page.getByRole('button', { name: 'Replace All Data' }).click();

    // Assert
    await expect(page.locator('#backup-message')).toHaveText('Backup restored.');
    // One of the two assets is archived, so it is hidden by default.
    await expect(page.locator('#assets-body tr')).toHaveCount(1);
    await expect(page.locator('#hide-archived-count')).toHaveText('(1 hidden)');
    expect(await allData(page)).toEqual(before);
});

test('E21 — an invalid file lists its problems and changes nothing', async ({ page }) => {
    // Arrange
    await openApp(page, SEEDED);
    const before = await allData(page);
    await openTab(page, 'Settings');
    const bad = {
        app: 'fintracker', version: 2, exportedAt: '2026-10-11T00:00:00.000Z', registeredRoom: [],
        settings: SEEDED.settings, transactions: [], closedMonths: [],
        balances: { '2026-13': {}, '2026-09': { ghost: 1 } }
    };

    // Act
    await restoreFile(page, 'bad.json', JSON.stringify(bad));
    const items = page.locator('#backup-message li');

    // Assert
    await expect(items).toHaveText(['Balances: invalid month "2026-13".', 'Balances 2026-09: unknown asset "ghost".']);
    await expect(page.locator('#restore-modal')).toBeHidden();
    expect(await allData(page)).toEqual(before);
});

test('E22 — cancelling a restore changes nothing', async ({ page }) => {
    // Arrange
    await openApp(page, SEEDED);
    const before = await allData(page);
    await openTab(page, 'Settings');
    const other = {
        app: 'fintracker', version: 2, exportedAt: '2026-10-11T00:00:00.000Z', registeredRoom: [],
        settings: makeSettings(), transactions: [], balances: {}, closedMonths: []
    };

    // Act
    await restoreFile(page, 'other.json', JSON.stringify(other));

    // Assert
    await expect(page.locator('#restore-modal')).toBeVisible();

    // Act
    await page.getByRole('button', { name: 'Cancel' }).click();

    // Assert
    await expect(page.locator('#restore-modal')).toBeHidden();
    expect(await allData(page)).toEqual(before);
    // One of the two assets is archived, so it is hidden by default.
    await expect(page.locator('#assets-body tr')).toHaveCount(1);
    await expect(page.locator('#hide-archived-count')).toHaveText('(1 hidden)');
});

test('E28 — Escape dismisses a restore and forgets the chosen file', async ({ page }) => {
    // Arrange
    await openApp(page, SEEDED);
    const before = await allData(page);
    await openTab(page, 'Settings');
    const other = {
        app: 'fintracker', version: 2, exportedAt: '2026-10-11T00:00:00.000Z', registeredRoom: [],
        settings: makeSettings(), transactions: [], balances: {}, closedMonths: []
    };
    await restoreFile(page, 'other.json', JSON.stringify(other));
    await expect(page.getByRole('dialog', { name: 'Restore backup' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeFocused();

    // Act
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.getElementById('restore-confirm-btn').click());

    // Assert
    await expect(page.locator('#restore-modal')).toBeHidden();
    expect(await allData(page)).toEqual(before);
});


const assetRow = (page, index) => page.locator('#assets-body tr').nth(index);
const assetField = (page, index, field) => assetRow(page, index).locator(`[data-field="${field}"]`);

test('v4 E17/E18 — a typed asset gets a generated, read-only name; a duplicate is refused', async ({ page }) => {
    // Arrange
    await openApp(page, { settings: makeSettings({ assets: [['a', 'Sentinel Savings', 'CAD'], ['b', 'Sentinel Other', 'CAD']] }) });
    await openTab(page, 'Settings');

    // Act
    await assetField(page, 0, 'institution').fill('Broker');
    await assetField(page, 0, 'owner').fill('Alex');
    await assetField(page, 0, 'holding').fill('ETF1');
    await assetField(page, 0, 'holding').press('Tab');
    await assetField(page, 0, 'type').selectOption('RRSP');

    // Assert
    await expect(assetField(page, 0, 'name')).toHaveValue('RRSP Broker - Alex - ETF1');
    await expect(assetField(page, 0, 'name')).toHaveAttribute('readonly', '');
    expect((await stored(page, 'settings')).assets[0]).toMatchObject({ name: 'RRSP Broker - Alex - ETF1', type: 'RRSP', holding: 'ETF1' });

    // Act
    await assetField(page, 1, 'institution').fill('Broker');
    await assetField(page, 1, 'owner').fill('alex');
    await assetField(page, 1, 'holding').fill('etf1');
    await assetField(page, 1, 'holding').press('Tab');
    await assetField(page, 1, 'type').selectOption('RRSP');

    // Assert
    await expect(page.locator('#asset-message')).toHaveText('"RRSP Broker - Alex - ETF1" already exists.');
    await expect(assetField(page, 1, 'name')).toHaveValue('Sentinel Other');

    // Act
    await assetField(page, 0, 'type').selectOption('');

    // Assert
    await expect(assetField(page, 0, 'name')).not.toHaveAttribute('readonly', '');
});

test('v4 E19 — a holding split is flagged until it adds up to 100%, then saved', async ({ page }) => {
    // Arrange
    const settings = makeSettings({ assets: [['a', 'Sentinel Fund', 'CAD']] });
    settings.assets[0].holding = 'ETF1';
    await openApp(page, { settings });
    await openTab(page, 'Settings');
    const share = key => page.locator(`#classes-table input[data-row="ETF1"][data-class="${key}"]`);
    const total = page.locator('#classes-table [data-total="ETF1"]');

    // Act
    await share('usEquity').fill('90');
    await share('usEquity').press('Tab');

    // Assert
    await expect(total).toHaveText('90%');
    await expect(total).toHaveClass(/bad/);
    await expect(page.locator('#classes-message')).toHaveText('ETF1: The split adds up to 90%; it must be 100%. Not saved yet.');
    expect((await stored(page, 'settings')).holdings).toEqual([]);

    // Act
    await share('intlEquity').fill('10');
    await share('intlEquity').press('Tab');

    // Assert
    await expect(total).toHaveText('100%');
    await expect(total).not.toHaveClass(/bad/);
    expect((await stored(page, 'settings')).holdings).toEqual([{ name: 'ETF1', split: { usEquity: 90, intlEquity: 10 } }]);
});

test('v4 E24 — a backup brings back splits, targets, FIRE inputs and room', async ({ page }) => {
    // Arrange
    const settings = makeSettings({ assets: [['a', 'Sentinel Fund', 'CAD']] });
    Object.assign(settings.assets[0], { type: 'TFSA', owner: 'Sam', holding: 'ETF1', name: 'TFSA - Sam - ETF1' });
    settings.holdings = [{ name: 'ETF1', split: { usEquity: 100 } }];
    settings.targets = { usEquity: 100 };
    Object.assign(settings.fire, { swr: 3.5, birthYear: 1990, projectionStart: 2017, projectionEnd: 2037 });
    const registeredRoom = [{ year: 2026, account: 'TFSA', person: 'Sam', room: 7000, contributed: 100 }];
    await openApp(page, { settings, registeredRoom });
    await openTab(page, 'Settings');
    const before = await allData(page);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download Backup' }).click();
    const content = await readFile(await (await downloadPromise).path(), 'utf8');

    // Act
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await openTab(page, 'Settings');
    await restoreFile(page, 'backup.json', content);
    await page.getByRole('button', { name: 'Replace All Data' }).click();

    // Assert
    await expect(page.locator('#backup-message')).toHaveText('Backup restored.');
    expect(await allData(page)).toEqual(before);
});

test('v4 E25/E26 — an older backup restores with defaults; a broken new one lists its problems', async ({ page }) => {
    // Arrange
    await openApp(page, { settings: makeSettings() });
    await openTab(page, 'Settings');
    const old = {
        app: 'fintracker', version: 1, exportedAt: '2026-10-11T00:00:00.000Z',
        settings: {
            version: 1, rates: { USD: null, BRL: null, date: null, refreshedAt: null },
            categories: { expense: ['Sem Categoria'], income: ['Sem Categoria'] },
            assets: [{ id: 'a', name: 'Sentinel Old', currency: 'CAD', archived: false }]
        },
        transactions: [], balances: {}, closedMonths: []
    };
    const broken = {
        app: 'fintracker', version: 2, exportedAt: '2026-10-11T00:00:00.000Z',
        settings: { ...makeSettings(), holdings: [{ name: 'ETF1', split: { usEquity: 60, cash: 60 } }] },
        transactions: [], balances: {}, closedMonths: [],
        registeredRoom: [{ year: '26', account: 'TFSA', person: 'Sam', room: 1, contributed: null }]
    };

    // Act
    await restoreFile(page, 'broken.json', JSON.stringify(broken));

    // Assert
    await expect(page.locator('#backup-message li')).toHaveText([
        'Holding 1: The split adds up to 120%; it must be 100%.',
        'Registered room 1: year must be a whole number from 1900 to 2100.'
    ]);

    // Act
    await restoreFile(page, 'old.json', JSON.stringify(old));
    await page.getByRole('button', { name: 'Replace All Data' }).click();

    // Assert
    await expect(page.locator('#backup-message')).toHaveText('Backup restored.');
    const restored = await stored(page, 'settings');
    expect(restored.version).toBe(2);
    expect(restored.assets[0]).toMatchObject({ name: 'Sentinel Old', type: null, holding: '' });
    expect(restored.fire.swr).toBe(4);
    expect(await stored(page, 'registeredRoom')).toEqual([]);
});

test('v4 E28 — archived assets are hidden until Hide archived is unchecked', async ({ page }) => {
    // Arrange
    await openApp(page, { settings: makeSettings({ assets: [['a', 'Sentinel Savings', 'CAD'], ['u', 'Sentinel Old', 'USD', true]] }) });
    await openTab(page, 'Settings');

    // Assert
    await expect(page.getByLabel('Hide archived')).toBeChecked();
    await expect(page.locator('#assets-body tr')).toHaveCount(1);
    await expect(page.locator('#hide-archived-count')).toHaveText('(1 hidden)');

    // Act
    await page.getByLabel('Hide archived').uncheck();

    // Assert
    await expect(page.locator('#assets-body tr')).toHaveCount(2);
    await expect(page.locator('#hide-archived-count')).toHaveText('');

    // Act
    await assetField(page, 0, 'archived').check();
    await page.getByLabel('Hide archived').check();

    // Assert
    await expect(page.locator('#assets-body tr[data-id]')).toHaveCount(0);
    await expect(page.locator('#hide-archived-count')).toHaveText('(2 hidden)');
});
