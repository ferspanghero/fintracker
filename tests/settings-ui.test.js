import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderSettings, initSettings } from '../js/settings-ui.js';
import { readFileText } from '../js/utils.js';
import { initModals } from '../js/modal.js';
import { transactions, settings, balances, closedMonths } from '../js/state.js';
import {
    rateUsdInput, rateBrlInput, refreshRatesBtn, rateNote, rateMessage,
    categoryChipsExpense, categoryChipsIncome, newCategoryTypeSelect, settingsNewCategoryInput, addCategoryBtn, categoryMessage,
    assetsBody, newAssetNameInput, newAssetCurrencySelect, addAssetBtn, assetMessage,
    downloadBackupBtn, restoreFileInput, backupMessage, restoreModal, restoreSummary, restoreConfirmBtn, restoreCancelBtn
} from '../js/dom.js';
import { buildBackup } from '../js/backup.js';
import { emptySettings } from '../js/settings.js';

const chip = name => Array.from(categoryChipsExpense.querySelectorAll('.chip')).find(c => c.dataset.name === name);
const change = (element, value) => {
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
};
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('settings UI', () => {
    let onDataChanged;

    beforeEach(() => {
        onDataChanged = vi.fn();
        initSettings({ onDataChanged });
        renderSettings();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    describe('exchange rates', () => {
        it('shows empty rates and says they are not set', () => {
            // Assert
            expect(rateUsdInput.value).toBe('');
            expect(rateBrlInput.value).toBe('');
            expect(rateNote.textContent).toBe('Rates not set.');
        });

        it('saves a valid rate typed by hand and marks it as manual', () => {
            // Arrange
            Object.assign(settings.rates, { USD: 1.3, date: '2026-10-01', refreshedAt: '2026-10-02T00:00:00.000Z' });

            // Act
            change(rateUsdInput, '1.45');

            // Assert
            expect(settings.rates.USD).toBe(1.45);
            expect(settings.rates.date).toBeNull();
            expect(rateNote.textContent).toBe('Entered manually.');
            expect(JSON.parse(localStorage.getItem('settings')).rates.USD).toBe(1.45);
            expect(onDataChanged).toHaveBeenCalled();
        });

        it('rejects an invalid rate and restores the field', () => {
            // Arrange
            settings.rates.BRL = 0.28;
            renderSettings();

            // Act
            change(rateBrlInput, '-1');

            // Assert
            expect(rateMessage.textContent).toBe('Enter a positive number.');
            expect(settings.rates.BRL).toBe(0.28);
            expect(rateBrlInput.value).toBe('0.28');
        });

        it('refreshes both rates from the Bank of Canada', async () => {
            // Arrange
            vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ observations: [{ d: '2026-10-09', FXUSDCAD: { v: '1.4' }, FXBRLCAD: { v: '0.27' } }] })
            }));

            // Act
            refreshRatesBtn.click();
            const disabledWhileFetching = refreshRatesBtn.disabled;
            await flush();

            // Assert
            expect(disabledWhileFetching).toBe(true);
            expect(refreshRatesBtn.disabled).toBe(false);
            expect(rateUsdInput.value).toBe('1.4');
            expect(rateBrlInput.value).toBe('0.27');
            expect(rateNote.textContent).toContain('Bank of Canada rate for 2026-10-09');
            expect(JSON.parse(localStorage.getItem('settings')).rates.BRL).toBe(0.27);
        });

        it('keeps rates and explains when the refresh fails', async () => {
            // Arrange
            vi.spyOn(console, 'error').mockImplementation(() => {});
            settings.rates.USD = 1.3;
            renderSettings();
            vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

            // Act
            refreshRatesBtn.click();
            await flush();

            // Assert
            expect(rateMessage.textContent).toBe("Couldn't reach the Bank of Canada. Rates unchanged.");
            expect(settings.rates.USD).toBe(1.3);
            expect(rateUsdInput.value).toBe('1.3');
            expect(refreshRatesBtn.disabled).toBe(false);
        });
    });

    describe('categories', () => {
        it('disables removal of a category in use and says how often it is used', () => {
            // Arrange
            transactions.push(...[1, 2, 3].map(() => ({ date: new Date(), description: 'x', amount: 1, type: 'expense', category: 'Casa', account: 'A' })));

            // Act
            renderSettings();

            // Assert
            const remove = chip('Casa').querySelector('button');
            expect(remove.disabled).toBe(true);
            expect(remove.title).toBe('Used by 3 transactions');
        });

        it('shows Sem Categoria without a remove button', () => {
            // Assert
            expect(chip('Sem Categoria').querySelector('button')).toBeNull();
        });

        it('removes an unused category everywhere', () => {
            // Act
            chip('Mercado').querySelector('button').click();

            // Assert
            expect(settings.categories.expense).not.toContain('Mercado');
            expect(chip('Mercado')).toBeUndefined();
            expect(JSON.parse(localStorage.getItem('settings')).categories.expense).not.toContain('Mercado');
            expect(onDataChanged).toHaveBeenCalled();
        });

        it('adds a category of the chosen type', () => {
            // Arrange
            newCategoryTypeSelect.value = 'income';
            settingsNewCategoryInput.value = 'Bonus';

            // Act
            addCategoryBtn.click();

            // Assert
            expect(settings.categories.income).toContain('Bonus');
            expect(settingsNewCategoryInput.value).toBe('');
            expect(categoryMessage.textContent).toBe('');
        });

        it('adds a category on Enter', () => {
            // Arrange
            settingsNewCategoryInput.value = 'Pets';

            // Act
            settingsNewCategoryInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

            // Assert
            expect(chip('Pets')).toBeTruthy();
        });

        it('shows the error for a duplicate name', () => {
            // Arrange
            settingsNewCategoryInput.value = 'casa';

            // Act
            addCategoryBtn.click();

            // Assert
            expect(categoryMessage.textContent).toBe('"Casa" already exists.');
            expect(settings.categories.expense.filter(c => c.toLowerCase() === 'casa')).toHaveLength(1);
        });
    });

    describe('assets', () => {
        const row = i => assetsBody.querySelectorAll('tr')[i];

        it('labels each asset control with the asset name', () => {
            // Arrange
            settings.assets.push({ id: 'a', name: 'Savings', currency: 'CAD', archived: false });

            // Act
            renderSettings();

            // Assert
            expect(row(0).querySelector('input[type="text"]').getAttribute('aria-label')).toBe('Name of Savings');
            expect(row(0).querySelector('select').getAttribute('aria-label')).toBe('Currency of Savings');
            expect(row(0).querySelector('input[type="checkbox"]').getAttribute('aria-label')).toBe('Archive Savings');
        });

        it('names the category chip groups', () => {
            // Arrange
            const nameOf = group => document.getElementById(group.getAttribute('aria-labelledby')).textContent;

            // Act
            renderSettings();

            // Assert
            expect(categoryChipsExpense.getAttribute('role')).toBe('group');
            expect(nameOf(categoryChipsExpense)).toBe('Expense');
            expect(nameOf(categoryChipsIncome)).toBe('Income');
        });

        it('adds an asset', () => {
            // Arrange
            newAssetNameInput.value = 'Savings';
            newAssetCurrencySelect.value = 'USD';

            // Act
            addAssetBtn.click();

            // Assert
            expect(settings.assets).toHaveLength(1);
            expect(settings.assets[0]).toMatchObject({ name: 'Savings', currency: 'USD', archived: false });
            expect(row(0).querySelector('input[type="text"]').value).toBe('Savings');
            expect(row(0).querySelector('select').value).toBe('USD');
            expect(newAssetNameInput.value).toBe('');
        });

        it('rejects a duplicate asset name', () => {
            // Arrange
            settings.assets.push({ id: 'a', name: 'Savings', currency: 'CAD', archived: false });
            newAssetNameInput.value = 'SAVINGS';

            // Act
            addAssetBtn.click();

            // Assert
            expect(assetMessage.textContent).toBe('"Savings" already exists.');
            expect(settings.assets).toHaveLength(1);
        });

        it('renames, changes currency and archives an asset', () => {
            // Arrange
            settings.assets.push({ id: 'a', name: 'Savings', currency: 'CAD', archived: false });
            renderSettings();

            // Act
            change(row(0).querySelector('input[type="text"]'), 'Emergency');
            change(row(0).querySelector('select'), 'USD');
            const archived = row(0).querySelector('input[type="checkbox"]');
            archived.checked = true;
            archived.dispatchEvent(new Event('change', { bubbles: true }));

            // Assert
            expect(settings.assets[0]).toEqual({ id: 'a', name: 'Emergency', currency: 'USD', archived: true });
            expect(JSON.parse(localStorage.getItem('settings')).assets[0].archived).toBe(true);
        });

        it('reverts a rename to an empty name and shows why', () => {
            // Arrange
            settings.assets.push({ id: 'a', name: 'Savings', currency: 'CAD', archived: false });
            renderSettings();

            // Act
            change(row(0).querySelector('input[type="text"]'), ' ');

            // Assert
            expect(assetMessage.textContent).toBe('Enter an asset name.');
            expect(row(0).querySelector('input[type="text"]').value).toBe('Savings');
        });

        it('escapes asset names', () => {
            // Arrange
            settings.assets.push({ id: 'a', name: '"><img src=x onerror=alert(1)>', currency: 'CAD', archived: false });

            // Act
            renderSettings();

            // Assert
            expect(assetsBody.querySelector('img')).toBeNull();
            expect(row(0).querySelector('input[type="text"]').value).toBe('"><img src=x onerror=alert(1)>');
        });
    });

    describe('backup and restore', () => {
        const restoreWith = async (content) => {
            Object.defineProperty(restoreFileInput, 'files', {
                value: [new File([content], 'backup.json', { type: 'application/json' })],
                configurable: true
            });
            restoreFileInput.dispatchEvent(new Event('change'));
            await vi.waitFor(() => {
                if (restoreModal.style.display !== 'block' && !backupMessage.textContent) {
                    throw new Error('restore still reading the file');
                }
            });
        };

        const validBackupText = () => {
            const next = emptySettings();
            next.assets.push({ id: 'z', name: 'Restored', currency: 'CAD', archived: false });

            return JSON.stringify(buildBackup({
                settings: next,
                transactions: [{ date: new Date(2026, 0, 2), description: 'R', amount: 1, type: 'expense', category: 'Sem Categoria', account: 'A' }],
                balances: { '2026-01': { z: 5 } },
                closedMonths: ['2026-01']
            }, new Date()));
        };

        it('downloads a dated backup of all data', async () => {
            // Arrange
            let saved;
            const createObjectURL = vi.fn(blob => {
                saved = blob;
                return 'blob:x';
            });
            vi.stubGlobal('URL', { createObjectURL, revokeObjectURL: vi.fn() });
            const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
                this.dataset.clickedDownload = this.download;
            });
            transactions.push({ date: new Date(2026, 0, 2), description: 'x', amount: 1, type: 'expense', category: 'Casa', account: 'A' });

            // Act
            downloadBackupBtn.click();
            const backup = JSON.parse(await readFileText(saved));

            // Assert
            expect(click).toHaveBeenCalled();
            expect(click.mock.contexts[0].download).toMatch(/^fintracker-backup-\d{4}-\d{2}-\d{2}\.json$/);
            expect(backup.app).toBe('fintracker');
            expect(backup.transactions).toHaveLength(1);
            expect(backup.settings).toEqual(settings);
        });

        it('asks before replacing data and restores on confirm', async () => {
            // Arrange
            localStorage.setItem('categories', '{}');
            transactions.push({ date: new Date(), description: 'old', amount: 1, type: 'expense', category: 'Casa', account: 'A' });

            // Act
            await restoreWith(validBackupText());
            const summary = restoreSummary.textContent;
            const shown = restoreModal.style.display;
            restoreConfirmBtn.click();

            // Assert
            expect(shown).toBe('block');
            expect(summary).toBe('1 transaction, 1 asset, 1 month of balances. This replaces all current data.');
            expect(transactions.map(t => t.description)).toEqual(['R']);
            expect(transactions[0].date).toBeInstanceOf(Date);
            expect(settings.assets[0].name).toBe('Restored');
            expect(balances).toEqual({ '2026-01': { z: 5 } });
            expect(closedMonths).toEqual(['2026-01']);
            expect(JSON.parse(localStorage.getItem('transactions'))).toHaveLength(1);
            expect(localStorage.getItem('categories')).toBeNull();
            expect(restoreModal.style.display).toBe('none');
            expect(backupMessage.textContent).toBe('Backup restored.');
            expect(onDataChanged).toHaveBeenCalled();
        });

        it('says so when the restored data cannot be saved and keeps the legacy key', async () => {
            // Arrange
            vi.spyOn(window, 'alert').mockImplementation(() => {});
            vi.spyOn(console, 'error').mockImplementation(() => {});
            localStorage.setItem('categories', '{}');
            await restoreWith(validBackupText());
            vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
                throw new DOMException('QuotaExceededError');
            });

            // Act
            restoreConfirmBtn.click();

            // Assert
            expect(backupMessage.textContent).toBe("The backup was loaded but couldn't be saved. Free up browser storage and restore again.");
            expect(localStorage.getItem('categories')).toBe('{}');
        });

        it('changes nothing when the restore is cancelled', async () => {
            // Arrange
            transactions.push({ date: new Date(), description: 'old', amount: 1, type: 'expense', category: 'Casa', account: 'A' });

            // Act
            await restoreWith(validBackupText());
            restoreCancelBtn.click();
            restoreConfirmBtn.click();

            // Assert
            expect(transactions.map(t => t.description)).toEqual(['old']);
            expect(restoreModal.style.display).toBe('none');
        });

        it.each([
            ['the × button', () => restoreModal.querySelector('.close').click()],
            ['the backdrop', () => restoreModal.click()],
            ['Escape', () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))]
        ])('forgets the chosen file when the dialog is closed with %s', async (_, close) => {
            // Arrange
            initModals();
            transactions.push({ date: new Date(), description: 'old', amount: 1, type: 'expense', category: 'Casa', account: 'A' });
            await restoreWith(validBackupText());

            // Act
            close();
            restoreConfirmBtn.click();

            // Assert
            expect(restoreModal.style.display).toBe('none');
            expect(transactions.map(t => t.description)).toEqual(['old']);
        });

        it('lists what is wrong with an invalid file and changes nothing', async () => {
            // Arrange
            const backup = JSON.parse(validBackupText());
            backup.balances['2026-01'].ghost = 1;
            backup.balances['2026-13'] = {};

            // Act
            await restoreWith(JSON.stringify(backup));

            // Assert
            const items = Array.from(backupMessage.querySelectorAll('li')).map(li => li.textContent);
            expect(items).toEqual(['Balances: invalid month "2026-13".', 'Balances 2026-01: unknown asset "ghost".']);
            expect(restoreModal.style.display).not.toBe('block');
            expect(settings.assets).toEqual([]);
        });

        it('caps a long error list', async () => {
            // Arrange
            const backup = JSON.parse(validBackupText());
            backup.transactions = Array.from({ length: 15 }, () => ({ date: 'bad' }));

            // Act
            await restoreWith(JSON.stringify(backup));

            // Assert
            const items = Array.from(backupMessage.querySelectorAll('li')).map(li => li.textContent);
            expect(items).toHaveLength(11);
            expect(items[10]).toMatch(/^…and \d+ more\.$/);
        });

        it('rejects a file that is not JSON', async () => {
            // Act
            await restoreWith('not json');

            // Assert
            expect(backupMessage.textContent).toContain("This file isn't valid JSON.");
        });

        it('escapes error text built from file contents', async () => {
            // Arrange
            const backup = JSON.parse(validBackupText());
            backup.closedMonths = ['<img src=x onerror=alert(1)>'];

            // Act
            await restoreWith(JSON.stringify(backup));

            // Assert
            expect(backupMessage.querySelector('img')).toBeNull();
        });
    });
});
