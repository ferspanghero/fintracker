import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderSettings, initSettings } from '../js/settings-ui.js';
import { readFileText } from '../js/utils.js';
import { initModals } from '../js/modal.js';
import { transactions, settings, balances, closedMonths, registeredRoom } from '../js/state.js';
import {
    rateUsdInput, rateBrlInput, refreshRatesBtn, rateNote, rateMessage,
    categoryChipsExpense, categoryChipsIncome, newCategoryTypeSelect, settingsNewCategoryInput, addCategoryBtn, categoryMessage,
    assetsBody, newAssetNameInput, newAssetCurrencySelect, addAssetBtn, assetMessage,
    newAssetTypeSelect, newAssetInstitutionInput, newAssetOwnerInput, newAssetHoldingInput, hideArchivedAssetsInput, hideArchivedCount,
    classesTable, classesMessage, fireInputs, fireInputMessage,
    downloadBackupBtn, restoreFileInput, backupMessage, restoreModal, restoreSummary, restoreConfirmBtn, restoreCancelBtn
} from '../js/dom.js';
import { buildBackup } from '../js/backup.js';
import { emptySettings, addAsset, setHoldingSplit, FIRE_DEFAULTS } from '../js/settings.js';

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
        vi.useRealTimers();
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
        const field = (i, name) => row(i).querySelector(`[data-field="${name}"]`);

        it('labels each asset control with the asset name', () => {
            // Arrange
            settings.assets.push({ id: 'a', name: 'Savings', currency: 'CAD', archived: false });

            // Act
            renderSettings();

            // Assert
            expect(field(0, 'name').getAttribute('aria-label')).toBe('Name of Savings');
            expect(field(0, 'currency').getAttribute('aria-label')).toBe('Currency of Savings');
            expect(field(0, 'archived').getAttribute('aria-label')).toBe('Archive Savings');
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
            expect(field(0, 'name').value).toBe('Savings');
            expect(field(0, 'currency').value).toBe('USD');
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
            change(field(0, 'name'), 'Emergency');
            change(field(0, 'currency'), 'USD');
            const archived = field(0, 'archived');
            archived.checked = true;
            archived.dispatchEvent(new Event('change', { bubbles: true }));

            // Assert
            expect(settings.assets[0]).toMatchObject({ id: 'a', name: 'Emergency', currency: 'USD', archived: true });
            expect(JSON.parse(localStorage.getItem('settings')).assets[0].archived).toBe(true);
        });

        it('reverts a rename to an empty name and shows why', () => {
            // Arrange
            settings.assets.push({ id: 'a', name: 'Savings', currency: 'CAD', archived: false });
            renderSettings();

            // Act
            change(field(0, 'name'), ' ');

            // Assert
            expect(assetMessage.textContent).toBe('Enter an asset name.');
            expect(field(0, 'name').value).toBe('Savings');
        });

        it('builds the name from the details once a type is set, and frees it when the type is cleared', () => {
            // Arrange
            addAsset(settings, 'Savings', 'CAD', () => 'a');
            renderSettings();
            const name = field(0, 'name');

            // Act
            change(field(0, 'institution'), 'Broker');
            change(field(0, 'owner'), 'Alex');
            change(field(0, 'holding'), 'ETF1');
            const beforeType = settings.assets[0].name;
            change(field(0, 'type'), 'RRSP');
            const typed = { name: name.value, readOnly: name.readOnly, same: field(0, 'name') === name };
            change(field(0, 'type'), '');

            // Assert
            expect(beforeType).toBe('Savings');
            expect(typed).toEqual({ name: 'RRSP Broker - Alex - ETF1', readOnly: true, same: true });
            expect(settings.assets[0]).toMatchObject({ name: 'RRSP Broker - Alex - ETF1', type: null, institution: 'Broker', owner: 'Alex', holding: 'ETF1' });
            expect(name.readOnly).toBe(false);
            expect(JSON.parse(localStorage.getItem('settings')).assets[0].holding).toBe('ETF1');
            expect(onDataChanged).toHaveBeenCalled();
            expect(Array.from(classesTable.querySelectorAll('tbody th')).map(th => th.textContent)).toEqual(['ETF1', 'Target']);
        });

        it('rejects details that would duplicate a name and puts the row back', () => {
            // Arrange
            addAsset(settings, 'n', 'CAD', () => 'a', { type: 'TFSA', owner: 'Sam' });
            addAsset(settings, 'Other', 'CAD', () => 'b');
            renderSettings();

            // Act
            change(field(1, 'owner'), 'Sam');
            change(field(1, 'type'), 'TFSA');

            // Assert
            expect(assetMessage.textContent).toBe('"TFSA - Sam" already exists.');
            expect(settings.assets[1]).toMatchObject({ name: 'Other', type: null, owner: 'Sam' });
            expect(field(1, 'type').value).toBe('');
        });

        it('puts a rejected detail back without rebuilding the table', () => {
            // Arrange
            addAsset(settings, 'n', 'CAD', () => 'a', { type: 'TFSA', owner: 'Sam' });
            addAsset(settings, 'Other', 'CAD', () => 'b', { type: 'TFSA', owner: 'Kim' });
            renderSettings();
            const owner = field(1, 'owner');
            const next = field(1, 'holding');
            next.focus();

            // Act
            change(owner, 'Sam');

            // Assert
            expect(field(1, 'owner')).toBe(owner);
            expect(owner.value).toBe('Kim');
            expect(document.activeElement).toBe(next);
            expect(settings.assets[1].owner).toBe('Kim');
        });

        it('adds an asset with details under its generated name', () => {
            // Arrange
            newAssetTypeSelect.value = 'TFSA';
            newAssetTypeSelect.dispatchEvent(new Event('change'));
            const nameDisabled = newAssetNameInput.disabled;
            newAssetInstitutionInput.value = 'Broker';
            newAssetOwnerInput.value = 'Sam';
            newAssetHoldingInput.value = 'ETF2';

            // Act
            addAssetBtn.click();

            // Assert
            expect(nameDisabled).toBe(true);
            expect(settings.assets[0]).toMatchObject({ name: 'TFSA Broker - Sam - ETF2', type: 'TFSA', owner: 'Sam', holding: 'ETF2' });
            expect([newAssetTypeSelect.value, newAssetInstitutionInput.value, newAssetOwnerInput.value, newAssetHoldingInput.value]).toEqual(['', '', '', '']);
            expect(newAssetNameInput.disabled).toBe(false);
        });

        it('offers every asset type', () => {
            // Assert
            expect(Array.from(newAssetTypeSelect.options).map(o => o.textContent)).toEqual([
                'No type', 'RRSP', 'RRSP/DPSP', 'Spousal RRSP', 'TFSA', 'Non-registered', 'Stocks', 'Savings', 'Chequing', 'Real estate'
            ]);
        });

        describe('hiding archived assets', () => {
            const shown = () => Array.from(assetsBody.querySelectorAll('tr[data-id]')).map(tr => tr.dataset.id);
            const toggle = checked => {
                hideArchivedAssetsInput.checked = checked;
                hideArchivedAssetsInput.dispatchEvent(new Event('change'));
            };

            beforeEach(() => {
                addAsset(settings, 'Active', 'CAD', () => 'a');
                addAsset(settings, 'Old', 'CAD', () => 'b');
                addAsset(settings, 'Older', 'CAD', () => 'c');
                settings.assets[1].archived = true;
                settings.assets[2].archived = true;
            });

            it('hides archived assets by default and says how many are hidden', () => {
                // Act
                renderSettings();

                // Assert
                expect(hideArchivedAssetsInput.checked).toBe(true);
                expect(shown()).toEqual(['a']);
                expect(hideArchivedCount.textContent).toBe('(2 hidden)');
            });

            it('shows them again when unchecked', () => {
                // Arrange
                renderSettings();

                // Act
                toggle(false);

                // Assert
                expect(shown()).toEqual(['a', 'b', 'c']);
                expect(hideArchivedCount.textContent).toBe('');
            });

            it('hides them again when checked', () => {
                // Arrange
                renderSettings();
                toggle(false);

                // Act
                toggle(true);

                // Assert
                expect(shown()).toEqual(['a']);
            });

            it('keeps the checkbox name fixed and announces the count separately', () => {
                // Assert
                expect(hideArchivedAssetsInput.closest('label').contains(hideArchivedCount)).toBe(false);
                expect(hideArchivedAssetsInput.getAttribute('aria-describedby')).toBe(hideArchivedCount.id);
                expect(hideArchivedCount.getAttribute('aria-live')).toBe('polite');
            });

            it('moves focus to the next row when the archived row disappears', () => {
                // Arrange
                settings.assets[2].archived = false;
                renderSettings();
                const archived = field(0, 'archived');
                archived.focus();

                // Act
                archived.checked = true;
                archived.dispatchEvent(new Event('change', { bubbles: true }));

                // Assert
                expect(shown()).toEqual(['c']);
                expect(document.activeElement).toBe(field(0, 'archived'));
            });

            it('moves focus to the previous row, or to the toggle when none are left', () => {
                // Arrange
                settings.assets[2].archived = false;
                renderSettings();
                const archive = i => {
                    const box = field(i, 'archived');
                    box.focus();
                    box.checked = true;
                    box.dispatchEvent(new Event('change', { bubbles: true }));
                };

                // Act
                archive(1);
                const afterLast = { id: document.activeElement.closest('tr').dataset.id, field: document.activeElement.dataset.field };
                archive(0);

                // Assert
                expect(afterLast).toEqual({ id: 'a', field: 'archived' });
                expect(document.activeElement).toBe(hideArchivedAssetsInput);
            });

            it('says why the table is empty when every asset is hidden', () => {
                // Arrange
                settings.assets[0].archived = true;

                // Act
                renderSettings();

                // Assert
                expect(assetsBody.textContent).toContain('All assets are archived. Uncheck Hide archived to see them.');
            });

            it('hides an asset as soon as it is archived', () => {
                // Arrange
                renderSettings();
                const archived = field(0, 'archived');

                // Act
                archived.checked = true;
                archived.dispatchEvent(new Event('change', { bubbles: true }));

                // Assert
                expect(settings.assets[0].archived).toBe(true);
                expect(shown()).toEqual([]);
                expect(hideArchivedCount.textContent).toBe('(3 hidden)');
            });

            it('shows no count when nothing is archived', () => {
                // Arrange
                settings.assets.forEach(asset => {
                    asset.archived = false;
                });

                // Act
                renderSettings();

                // Assert
                expect(hideArchivedCount.textContent).toBe('');
            });
        });

        it('escapes asset names', () => {
            // Arrange
            settings.assets.push({ id: 'a', name: '"><img src=x onerror=alert(1)>', currency: 'CAD', archived: false });

            // Act
            renderSettings();

            // Assert
            expect(assetsBody.querySelector('img')).toBeNull();
            expect(field(0, 'name').value).toBe('"><img src=x onerror=alert(1)>');
        });
    });

    describe('asset classes', () => {
        const classInput = (row, key) => classesTable.querySelector(`input[data-row="${row}"][data-class="${key}"]`);
        const total = row => classesTable.querySelector(`[data-total="${row}"]`);
        const type = (input, text) => {
            input.value = text;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
        };

        beforeEach(() => {
            addAsset(settings, 'n', 'CAD', () => 'a', { type: 'TFSA', owner: 'Sam', holding: 'ETF1' });
            addAsset(settings, 'n', 'CAD', () => 'b', { type: 'RRSP', owner: 'Alex', holding: 'etf1' });
            addAsset(settings, 'n', 'CAD', () => 'c', { type: 'Savings', owner: 'Joint', holding: '<Cash>' });
            setHoldingSplit(settings, 'ETF1', { usEquity: 60, intlEquity: 40 });
            renderSettings();
        });

        it('lists each holding once with its split and total, then the target row', () => {
            // Assert
            expect(Array.from(classesTable.querySelectorAll('tbody th')).map(th => th.textContent)).toEqual(['ETF1', '<Cash>', 'Target']);
            expect(classInput('ETF1', 'usEquity').value).toBe('60');
            expect(classInput('ETF1', 'cash').value).toBe('');
            expect(total('ETF1').textContent).toBe('100%');
            expect(total('<Cash>').textContent).toBe('—');
            expect(classInput('ETF1', 'usEquity').getAttribute('aria-label')).toBe('US Equity % of ETF1');
            expect(classesTable.querySelectorAll('thead th')).toHaveLength(9);
        });

        it('saves a split once it adds up to 100% and flags it until then', () => {
            // Act
            type(classInput('<Cash>', 'cash'), '90');
            const flagged = { total: total('<Cash>').textContent, bad: total('<Cash>').classList.contains('bad'), message: classesMessage.textContent };
            type(classInput('<Cash>', 'fixedIncome'), '10');

            // Assert
            expect(flagged).toEqual({ total: '90%', bad: true, message: '<Cash>: The split adds up to 90%; it must be 100%. Not saved yet.' });
            expect(settings.holdings.find(h => h.name === '<Cash>').split).toEqual({ fixedIncome: 10, cash: 90 });
            expect(total('<Cash>').classList.contains('bad')).toBe(false);
            expect(classesMessage.textContent).toBe('');
            expect(JSON.parse(localStorage.getItem('settings')).holdings).toHaveLength(2);
            expect(onDataChanged).toHaveBeenCalled();
        });

        it('clears a split when its row is emptied', () => {
            // Act
            type(classInput('ETF1', 'usEquity'), '');
            type(classInput('ETF1', 'intlEquity'), '');

            // Assert
            expect(settings.holdings).toEqual([]);
            expect(total('ETF1').textContent).toBe('—');
        });

        it('saves the target row the same way', () => {
            // Act
            type(classInput('target', 'usEquity'), '70');
            type(classInput('target', 'cash'), '30');

            // Assert
            expect(settings.targets).toEqual({ usEquity: 70, cash: 30 });
        });

        it('says how to get rows when no asset has a holding', () => {
            // Arrange
            settings.assets.length = 0;

            // Act
            renderSettings();

            // Assert
            expect(classesTable.querySelector('tbody').textContent).toContain('Give assets a Holding to set its class split.');
            expect(classInput('target', 'cash')).not.toBeNull();
        });

        it('shows no total while a share is not a number', () => {
            // Act
            type(classInput('<Cash>', 'cash'), 'abc');

            // Assert
            expect(total('<Cash>').textContent).toBe('—');
            expect(total('<Cash>').classList.contains('bad')).toBe(true);
            expect(classesMessage.textContent).toBe('<Cash>: Each share must be a number from 0 to 100. Not saved yet.');
        });

        it('ignores events that do not come from a share input', () => {
            // Act
            classesTable.dispatchEvent(new Event('change', { bubbles: true }));
            classesTable.dispatchEvent(new Event('input', { bubbles: true }));

            // Assert
            expect(classesMessage.textContent).toBe('');
        });
    });

    describe('FIRE assumptions', () => {
        const input = name => fireInputs.querySelector(`[data-fire="${name}"]`);

        it('shows every input with its explanation and the defaults', () => {
            // Assert
            expect(input('swr').value).toBe('4');
            expect(input('retirementSpending').value).toBe('');
            expect(input('birthYear').value).toBe('');
            expect(fireInputs.querySelectorAll('.tip')).toHaveLength(8);
            expect(fireInputs.querySelectorAll('[data-fire]')).toHaveLength(9);
        });

        it('shows the worked-out defaults in grey where a blank input uses them, and explains them', () => {
            // Arrange
            vi.useFakeTimers({ toFake: ['Date'] });
            vi.setSystemTime(new Date(2026, 9, 17));
            settings.assets.push({ id: 'a', name: 'A', currency: 'CAD', archived: false, type: null, institution: '', owner: '', holding: '' });
            Object.assign(balances, { '2024-03': { a: 1 }, '2026-09': { a: 1 } });
            transactions.push({ date: new Date(2026, 8, 5), description: 'Rent', amount: 1500, type: 'expense', category: 'Casa', account: 'A' });

            const tipText = name => input(name).closest('.fire-input').querySelector('[role="tooltip"]').textContent;

            // Act
            renderSettings();

            // Assert
            expect(input('retirementSpending').placeholder).toBe('1,500');
            expect(input('retirementSpending').classList.contains('has-default')).toBe(true);
            expect(tipText('retirementSpending')).toContain('Right now that is $1,500 (Oct 2025 – Sep 2026).');
            expect(input('projectionStart').placeholder).toBe('2024');
            expect(input('projectionEnd').placeholder).toBe('2046');
            expect(tipText('projectionStart')).toContain('Right now: 2024 through 2046.');
            expect(input('swr').classList.contains('has-default')).toBe(false);
        });

        it('says there is no default spending yet without balances', () => {
            // Act
            const tipText = input('retirementSpending').closest('.fire-input').querySelector('[role="tooltip"]').textContent;

            // Assert
            expect(input('retirementSpending').placeholder).toBe('');
            expect(tipText).toContain('There are no balances yet to work it out from.');
        });

        it('saves a valid input without rebuilding the form', () => {
            // Arrange
            const swr = input('swr');

            // Act
            change(swr, '3.5');

            // Assert
            expect(settings.fire.swr).toBe(3.5);
            expect(input('swr')).toBe(swr);
            expect(JSON.parse(localStorage.getItem('settings')).fire.swr).toBe(3.5);
            expect(fireInputMessage.textContent).toBe('');
            expect(onDataChanged).toHaveBeenCalled();
        });

        it('shows a stored override with thousands separators', () => {
            // Arrange
            settings.fire.retirementSpending = 100000;

            // Act
            renderSettings();

            // Assert
            expect(input('retirementSpending').value).toBe('100,000');
        });

        it('overrides the retirement spending and goes back to the default when cleared', () => {
            // Act
            change(input('retirementSpending'), '100,000');
            const overridden = settings.fire.retirementSpending;
            change(input('retirementSpending'), '');

            // Assert
            expect(overridden).toBe(100000);
            expect(settings.fire.retirementSpending).toBeNull();
        });

        it('puts back only the rejected input, keeping the form and focus in place', () => {
            // Arrange
            const swr = input('swr');
            const inflation = input('inflation');
            inflation.focus();

            // Act
            change(swr, '0');

            // Assert
            expect(input('swr')).toBe(swr);
            expect(swr.value).toBe('4');
            expect(document.activeElement).toBe(inflation);
            expect(fireInputMessage.textContent).toBe('Enter a number above 0 and up to 100.');
        });

        it('labels each input once, through its label', () => {
            // Assert
            expect(fireInputs.querySelector('[aria-label]')).toBeNull();
            expect(document.querySelector('label[for="fire-swr"]')).not.toBeNull();
        });

        it('rejects an invalid input and puts the stored value back', () => {
            // Act
            change(input('projectionStart'), '2040');
            change(input('projectionEnd'), '2030');

            // Assert
            expect(fireInputMessage.textContent).toBe('The projection end year must be after its start year.');
            expect(input('projectionEnd').value).toBe('');
            expect(settings.fire).toEqual({ ...FIRE_DEFAULTS, projectionStart: 2040 });
        });

        it('ignores changes that are not FIRE inputs', () => {
            // Act
            fireInputs.dispatchEvent(new Event('change', { bubbles: true }));

            // Assert
            expect(settings.fire).toEqual(FIRE_DEFAULTS);
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
            next.assets.push({ id: 'z', name: 'Restored', currency: 'CAD', archived: false, type: null, institution: '', owner: '', holding: '' });

            return JSON.stringify(buildBackup({
                settings: next,
                transactions: [{ date: new Date(2026, 0, 2), description: 'R', amount: 1, type: 'expense', category: 'Sem Categoria', account: 'A' }],
                balances: { '2026-01': { z: 5 } },
                closedMonths: ['2026-01'],
                registeredRoom: [{ year: 2026, account: 'TFSA', person: 'Sam', room: 7000, contributed: 100 }]
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
            registeredRoom.push({ year: 2026, account: 'RRSP', person: 'Alex', room: 1, contributed: 2 });

            // Act
            downloadBackupBtn.click();
            const backup = JSON.parse(await readFileText(saved));

            // Assert
            expect(click).toHaveBeenCalled();
            expect(click.mock.contexts[0].download).toMatch(/^fintracker-backup-\d{4}-\d{2}-\d{2}\.json$/);
            expect(backup.app).toBe('fintracker');
            expect(backup.transactions).toHaveLength(1);
            expect(backup.settings).toEqual(settings);
            expect(backup.registeredRoom).toEqual([{ year: 2026, account: 'RRSP', person: 'Alex', room: 1, contributed: 2 }]);
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
            expect(summary).toBe('1 transaction, 1 asset, 1 month of balances, 1 registered room entry. This replaces all current data.');
            expect(transactions.map(t => t.description)).toEqual(['R']);
            expect(transactions[0].date).toBeInstanceOf(Date);
            expect(settings.assets[0].name).toBe('Restored');
            expect(balances).toEqual({ '2026-01': { z: 5 } });
            expect(closedMonths).toEqual(['2026-01']);
            expect(registeredRoom).toEqual([{ year: 2026, account: 'TFSA', person: 'Sam', room: 7000, contributed: 100 }]);
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
