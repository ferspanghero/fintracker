// Settings tab: exchange rates, the category list, assets, and Backup / Restore.
// Rules live in settings.js and backup.js; this module renders and wires them.

import { transactions, settings, balances, closedMonths, replaceAll } from './state.js';
import {
    rateUsdInput, rateBrlInput, refreshRatesBtn, rateNote, rateMessage,
    categoryChipsExpense, categoryChipsIncome, newCategoryTypeSelect, settingsNewCategoryInput, addCategoryBtn, categoryMessage,
    assetsBody, newAssetNameInput, newAssetCurrencySelect, addAssetBtn, assetMessage,
    downloadBackupBtn, restoreBtn, restoreFileInput, backupMessage, restoreModal, restoreSummary, restoreConfirmBtn, restoreCancelBtn
} from './dom.js';
import { saveData, clearLegacyKeys } from './storage.js';
import {
    addCategory, removeCategory, countCategoryUsage, addAsset, renameAsset, setAssetCurrency,
    setAssetArchived, setRate, applyRates, CURRENCIES
} from './settings.js';
import { fetchLatestRates } from './rates.js';
import { openModal, closeModal } from './modal.js';
import { buildBackup, validateBackup, describeBackup, backupFileName } from './backup.js';
import { escapeHTML, readFileText } from './utils.js';
import { UNCATEGORIZED } from './category-engine.js';
import { INCOME, EXPENSE } from './constants.js';

const MAX_LISTED_ERRORS = 10;

let notifyDataChanged = () => {};
let pendingRestore = null;

function rateNoteText() {
    const { USD, BRL, date, refreshedAt } = settings.rates;

    if (date && refreshedAt) {
        return `Bank of Canada rate for ${date} · refreshed ${new Date(refreshedAt).toLocaleString()}`;
    }

    return USD || BRL ? 'Entered manually.' : 'Rates not set.';
}

function renderRates() {
    rateUsdInput.value = settings.rates.USD ?? '';
    rateBrlInput.value = settings.rates.BRL ?? '';
    rateNote.textContent = rateNoteText();
}

function renderChips(container, type) {
    container.innerHTML = settings.categories[type].map(name => {
        if (name === UNCATEGORIZED) {
            return `<span class="chip fixed" data-name="${escapeHTML(name)}">${escapeHTML(name)}</span>`;
        }

        const used = countCategoryUsage(transactions, type, name);
        const title = used ? `Used by ${used} transaction${used === 1 ? '' : 's'}` : `Remove ${name}`;

        return `<span class="chip" data-name="${escapeHTML(name)}">${escapeHTML(name)}
            <button type="button" data-type="${type}" title="${escapeHTML(title)}" aria-label="${escapeHTML(title)}"${used ? ' disabled' : ''}>×</button>
        </span>`;
    }).join('');
}

function renderAssets() {
    assetsBody.innerHTML = settings.assets.map(asset => {
        const name = escapeHTML(asset.name);

        return `
        <tr data-id="${escapeHTML(asset.id)}">
            <td><input type="text" value="${name}" aria-label="Name of ${name}"></td>
            <td><select aria-label="Currency of ${name}">${CURRENCIES.map(c =>
                `<option value="${c}"${c === asset.currency ? ' selected' : ''}>${c}</option>`).join('')}</select></td>
            <td class="ctr"><input type="checkbox" aria-label="Archive ${name}"${asset.archived ? ' checked' : ''}></td>
        </tr>`;
    }).join('');
}

/** Renders every Settings section from current state. */
export function renderSettings() {
    renderRates();
    renderChips(categoryChipsExpense, EXPENSE);
    renderChips(categoryChipsIncome, INCOME);
    renderAssets();
}

function commit() {
    saveData();
    renderSettings();
    notifyDataChanged();
}

function handleRateChange(currency, input) {
    const result = setRate(settings, currency, input.value);

    if (!result.ok) {
        rateMessage.textContent = result.error;
        renderRates();

        return;
    }

    rateMessage.textContent = '';
    settings.rates.date = null;
    settings.rates.refreshedAt = null;
    commit();
}

async function handleRefreshRates() {
    refreshRatesBtn.disabled = true;
    refreshRatesBtn.textContent = 'Refreshing...';
    rateMessage.textContent = '';

    try {
        applyRates(settings, await fetchLatestRates(), new Date());
        commit();
    } catch (error) {
        console.error('Rate refresh failed:', error);
        rateMessage.textContent = "Couldn't reach the Bank of Canada. Rates unchanged.";
    } finally {
        refreshRatesBtn.disabled = false;
        refreshRatesBtn.textContent = 'Refresh Rates';
    }
}

function handleChipClick(event) {
    const button = event.target.closest('button[data-type]');

    if (!button) {
        return;
    }

    const result = removeCategory(settings, button.dataset.type, button.closest('.chip').dataset.name, transactions);
    categoryMessage.textContent = result.ok ? '' : result.error;

    if (result.ok) {
        commit();
    }
}

function handleAddCategory() {
    const result = addCategory(settings, newCategoryTypeSelect.value, settingsNewCategoryInput.value);
    categoryMessage.textContent = result.ok ? '' : result.error;

    if (result.ok) {
        settingsNewCategoryInput.value = '';
        commit();
    }
}

function handleAddAsset() {
    const result = addAsset(settings, newAssetNameInput.value, newAssetCurrencySelect.value);
    assetMessage.textContent = result.ok ? '' : result.error;

    if (result.ok) {
        newAssetNameInput.value = '';
        commit();
    }
}

function handleAssetChange(event) {
    const id = event.target.closest('tr').dataset.id;
    let result;

    if (event.target.type === 'checkbox') {
        result = setAssetArchived(settings, id, event.target.checked);
    } else if (event.target.tagName === 'SELECT') {
        result = setAssetCurrency(settings, id, event.target.value);
    } else {
        result = renameAsset(settings, id, event.target.value);
    }

    assetMessage.textContent = result.ok ? '' : result.error;

    if (result.ok) {
        commit();
    } else {
        renderAssets();
    }
}

function downloadBackup() {
    const now = new Date();
    const backup = buildBackup({ settings, transactions, balances, closedMonths }, now);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const link = document.createElement('a');

    link.href = url;
    link.download = backupFileName(now);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function showBackupErrors(errors) {
    const listed = errors.slice(0, MAX_LISTED_ERRORS);

    if (errors.length > MAX_LISTED_ERRORS) {
        listed.push(`…and ${errors.length - MAX_LISTED_ERRORS} more.`);
    }

    backupMessage.innerHTML = `<p>Nothing was restored. The file has problems:</p>
        <ul>${listed.map(error => `<li>${escapeHTML(error)}</li>`).join('')}</ul>`;
}

async function handleRestoreFile() {
    const [file] = restoreFileInput.files;
    restoreFileInput.value = '';
    backupMessage.textContent = '';

    if (!file) {
        return;
    }

    let parsed;

    try {
        parsed = JSON.parse(await readFileText(file));
    } catch {
        showBackupErrors(["This file isn't valid JSON."]);

        return;
    }

    const result = validateBackup(parsed);

    if (!result.ok) {
        showBackupErrors(result.errors);

        return;
    }

    pendingRestore = result.data;
    restoreSummary.textContent = describeBackup(result.data);
    openModal(restoreModal);
}

function confirmRestore() {
    if (!pendingRestore) {
        return;
    }

    replaceAll(pendingRestore);
    closeModal(restoreModal);
    const saved = saveData();
    renderSettings();
    notifyDataChanged();

    if (!saved) {
        backupMessage.textContent = "The backup was loaded but couldn't be saved. Free up browser storage and restore again.";

        return;
    }

    clearLegacyKeys();
    backupMessage.textContent = 'Backup restored.';
}

/**
 * Wires the Settings tab; call once after the DOM is ready.
 * @param {{onDataChanged: Function}} options called after any change other views must reflect
 */
export function initSettings({ onDataChanged }) {
    notifyDataChanged = onDataChanged;
    rateUsdInput.addEventListener('change', () => handleRateChange('USD', rateUsdInput));
    rateBrlInput.addEventListener('change', () => handleRateChange('BRL', rateBrlInput));
    refreshRatesBtn.addEventListener('click', handleRefreshRates);
    categoryChipsExpense.addEventListener('click', handleChipClick);
    categoryChipsIncome.addEventListener('click', handleChipClick);
    addCategoryBtn.addEventListener('click', handleAddCategory);
    settingsNewCategoryInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            handleAddCategory();
        }
    });
    addAssetBtn.addEventListener('click', handleAddAsset);
    newAssetNameInput.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            handleAddAsset();
        }
    });
    assetsBody.addEventListener('change', handleAssetChange);
    downloadBackupBtn.addEventListener('click', downloadBackup);
    restoreBtn.addEventListener('click', () => restoreFileInput.click());
    restoreFileInput.addEventListener('change', handleRestoreFile);
    restoreConfirmBtn.addEventListener('click', confirmRestore);
    restoreCancelBtn.addEventListener('click', () => closeModal(restoreModal));
    // However the dialog closes (Cancel, ×, backdrop, Escape, or after a restore), the chosen file is dropped.
    restoreModal.addEventListener('modal-close', () => {
        pendingRestore = null;
    });
}
