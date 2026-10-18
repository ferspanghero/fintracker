// Settings tab: exchange rates, the category list, assets, asset classes, FIRE
// assumptions, and Backup / Restore.
// Rules live in settings.js and backup.js; this module renders and wires them.

import { transactions, settings, balances, closedMonths, registeredRoom, replaceAll } from './state.js';
import {
    rateUsdInput, rateBrlInput, refreshRatesBtn, rateNote, rateMessage,
    categoryChipsExpense, categoryChipsIncome, newCategoryTypeSelect, settingsNewCategoryInput, addCategoryBtn, categoryMessage,
    assetsBody, newAssetNameInput, newAssetCurrencySelect, addAssetBtn, assetMessage,
    newAssetTypeSelect, newAssetInstitutionInput, newAssetOwnerInput, newAssetHoldingInput, hideArchivedAssetsInput, hideArchivedCount,
    classesTable, classesMessage, fireInputs, fireInputMessage,
    downloadBackupBtn, restoreBtn, restoreFileInput, backupMessage, restoreModal, restoreSummary, restoreConfirmBtn, restoreCancelBtn
} from './dom.js';
import { saveData, clearLegacyKeys } from './storage.js';
import {
    addCategory, removeCategory, countCategoryUsage, addAsset, renameAsset, setAssetCurrency,
    setAssetArchived, setRate, applyRates, CURRENCIES, ASSET_TYPES, ASSET_CLASSES,
    setAssetDetails, holdingNames, findHolding, setHoldingSplit, setTargets, setFireInput, parseTypedNumber
} from './settings.js';
import { recentFlows, defaultProjectionYears } from './fire.js';
import { tip } from './explanations.js';
import { fetchLatestRates } from './rates.js';
import { openModal, closeModal } from './modal.js';
import { buildBackup, validateBackup, describeBackup, backupFileName } from './backup.js';
import { escapeHTML, readFileText, formatNumber, formatMoney, monthLabel } from './utils.js';
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

const DETAIL_FIELDS = ['type', 'institution', 'owner', 'holding'];
const typeOptions = selected => [['', 'No type'], ...ASSET_TYPES.map(({ name }) => [name, name])].map(([value, label]) =>
    `<option value="${escapeHTML(value)}"${value === (selected ?? '') ? ' selected' : ''}>${escapeHTML(label)}</option>`).join('');

function renderAssets() {
    if (!newAssetTypeSelect.options.length) {
        newAssetTypeSelect.innerHTML = typeOptions('');
    }

    // Hiding archived assets is a view choice only: it starts on with each page load and isn't saved.
    const hide = hideArchivedAssetsInput.checked;
    const archived = settings.assets.filter(asset => asset.archived).length;
    hideArchivedCount.textContent = hide && archived ? `(${archived} hidden)` : '';

    const visible = settings.assets.filter(asset => !hide || !asset.archived);

    if (!visible.length && archived) {
        assetsBody.innerHTML = '<tr><td colspan="7" class="hint">All assets are archived. Uncheck Hide archived to see them.</td></tr>';

        return;
    }

    assetsBody.innerHTML = visible.map(asset => {
        const name = escapeHTML(asset.name);
        const text = (field, label) =>
            `<td><input type="text" data-field="${field}" value="${escapeHTML(asset[field] ?? '')}" aria-label="${label} of ${name}"></td>`;

        return `
        <tr data-id="${escapeHTML(asset.id)}">
            <td><input type="text" data-field="name" value="${name}" aria-label="Name of ${name}"${asset.type ? ' readonly' : ''}></td>
            <td><select data-field="type" aria-label="Type of ${name}">${typeOptions(asset.type)}</select></td>
            ${text('institution', 'Institution')}
            ${text('owner', 'Owner')}
            ${text('holding', 'Holding')}
            <td><select data-field="currency" aria-label="Currency of ${name}">${CURRENCIES.map(c =>
                `<option value="${c}"${c === asset.currency ? ' selected' : ''}>${c}</option>`).join('')}</select></td>
            <td class="ctr"><input type="checkbox" data-field="archived" aria-label="Archive ${name}"${asset.archived ? ' checked' : ''}></td>
        </tr>`;
    }).join('');
}

const shareValue = share => (share === undefined ? '' : String(share));

// The running total of typed shares; '—' while the row is blank or a share isn't a number.
function totalText(shares) {
    const typed = shares.map(share => share.trim()).filter(Boolean).map(parseTypedNumber);

    return typed.length && !typed.some(Number.isNaN) ? `${Number(typed.reduce((sum, share) => sum + share, 0).toFixed(2))}%` : '—';
}

function classRow(rowKey, label, split, rowClass = '') {
    const shares = ASSET_CLASSES.map(({ key }) => shareValue(split?.[key]));
    const inputs = ASSET_CLASSES.map(({ key, label: classLabel }, i) =>
        `<td><input type="text" inputmode="decimal" data-row="${escapeHTML(rowKey)}" data-class="${key}" value="${escapeHTML(shares[i])}"
            aria-label="${escapeHTML(`${classLabel} % of ${label}`)}"></td>`).join('');

    return `<tr${rowClass ? ` class="${rowClass}"` : ''}><th scope="row">${escapeHTML(label)}</th>${inputs}<td class="total" data-total="${escapeHTML(rowKey)}">${totalText(shares)}</td></tr>`;
}

function renderClasses() {
    const holdings = holdingNames(settings);
    const rows = holdings.length
        ? holdings.map(name => classRow(name, name, findHolding(settings, name))).join('')
        : `<tr><td colspan="${ASSET_CLASSES.length + 2}" class="hint">Give assets a Holding to set its class split.</td></tr>`;

    classesTable.innerHTML = `<thead><tr><th scope="col">Holding</th>${ASSET_CLASSES.map(({ short, label }) =>
        `<th scope="col" title="${escapeHTML(label)}">${escapeHTML(short)}</th>`).join('')}<th scope="col">Total</th></tr></thead>
        <tbody>${rows}${classRow('target', 'Target', settings.targets, 'target')}</tbody>`;
}

// FIRE inputs in display order: [field, explanation key, label].
const FIRE_FORM = [
    ['swr', 'swr', 'SWR (%)'],
    ['withdrawalTax', 'withdrawalTax', 'Withdrawal tax (%)'],
    ['retirementSpending', 'spending', 'Retirement spending (CAD)'],
    ['expectedReturn', 'expectedReturn', 'Expected return (%)'],
    ['inflation', 'inflation', 'Inflation (%)'],
    ['nonRegTaxDrag', 'nonRegTaxDrag', 'Non-reg tax drag (%)'],
    ['birthYear', 'birthYear', 'Birth year'],
    ['projectionStart', 'projectionYears', 'Projection start year'],
    ['projectionEnd', null, 'Projection end year']
];

// What a blank input falls back to, worked out from your data: the placeholder it shows and the
// sentence added to its explanation.
function fireDefaults() {
    const recent = recentFlows({ transactions, balances, settings });
    const years = defaultProjectionYears({ balances, settings, today: new Date() });

    return {
        retirementSpending: recent
            ? {
                placeholder: formatNumber(recent.spending, 0),
                note: `Right now that is ${formatMoney(recent.spending)} (${monthLabel(recent.firstMonth)} – ${monthLabel(recent.latestMonth)}).`
            }
            : { placeholder: '', note: 'There are no balances yet to work it out from.' },
        projectionStart: { placeholder: String(years.start), note: `Right now: ${years.start} through ${years.end}.` },
        projectionEnd: { placeholder: String(years.end) }
    };
}

// Amounts get thousands separators like their placeholder; years and percentages show as stored.
const fireInputValue = field => {
    const value = settings.fire[field];

    if (value === null) {
        return '';
    }

    return field === 'retirementSpending' ? value.toLocaleString('en-CA', { maximumFractionDigits: 2 }) : String(value);
};

function renderFireInputs() {
    const defaults = fireDefaults();

    fireInputs.innerHTML = FIRE_FORM.map(([field, key, label]) => {
        const fallback = defaults[field];
        const term = key ? tip(key, label, { extra: fallback?.note }) : escapeHTML(label);
        const placeholder = fallback ? ` class="has-default" placeholder="${escapeHTML(fallback.placeholder)}"` : '';

        return `<div class="fire-input">
            <label for="fire-${field}">${term}</label>
            <input type="text" inputmode="decimal" id="fire-${field}" data-fire="${field}" value="${escapeHTML(fireInputValue(field))}"${placeholder}>
        </div>`;
    }).join('');
}

/** Renders every Settings section from current state. */
export function renderSettings() {
    renderRates();
    renderChips(categoryChipsExpense, EXPENSE);
    renderChips(categoryChipsIncome, INCOME);
    renderAssets();
    renderClasses();
    renderFireInputs();
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

const NEW_ASSET_DETAILS = () => ({
    type: newAssetTypeSelect.value,
    institution: newAssetInstitutionInput.value,
    owner: newAssetOwnerInput.value,
    holding: newAssetHoldingInput.value
});

// A typed asset's name is generated, so the free-text name only applies without a type.
function syncNewAssetName() {
    newAssetNameInput.disabled = newAssetTypeSelect.value !== '';
}

function handleAddAsset() {
    const result = addAsset(settings, newAssetNameInput.value, newAssetCurrencySelect.value, undefined, NEW_ASSET_DETAILS());
    assetMessage.textContent = result.ok ? '' : result.error;

    if (result.ok) {
        [newAssetNameInput, newAssetTypeSelect, newAssetInstitutionInput, newAssetOwnerInput, newAssetHoldingInput].forEach(input => {
            input.value = '';
        });
        syncNewAssetName();
        commit();
    }
}

// Saves a detail change and updates the row in place so focus stays where the user moved it.
function handleDetailChange(row, id) {
    const details = Object.fromEntries(DETAIL_FIELDS.map(field => [field, row.querySelector(`[data-field="${field}"]`).value]));
    const result = setAssetDetails(settings, id, details);
    assetMessage.textContent = result.ok ? '' : result.error;

    const asset = settings.assets.find(a => a.id === id);

    // In place either way, so focus stays where the user moved it; a rejected change goes back to the stored details.
    if (!result.ok) {
        DETAIL_FIELDS.forEach(field => {
            row.querySelector(`[data-field="${field}"]`).value = asset[field] ?? '';
        });

        return;
    }

    const name = row.querySelector('[data-field="name"]');
    name.value = asset.name;
    name.readOnly = Boolean(asset.type);
    saveData();
    renderClasses();
    notifyDataChanged();
}

const archivedBox = id => Array.from(assetsBody.querySelectorAll('tr[data-id]'))
    .find(tr => tr.dataset.id === id)?.querySelector('[data-field="archived"]');

// Archiving can hide the row; focus then moves to the next row's checkbox, the previous one's, or the toggle.
function archiveAsset(row, id, archived) {
    const neighbours = [id, row.nextElementSibling?.dataset.id, row.previousElementSibling?.dataset.id];

    setAssetArchived(settings, id, archived);
    assetMessage.textContent = '';
    commit();
    (neighbours.map(archivedBox).find(Boolean) ?? hideArchivedAssetsInput).focus();
}

function handleAssetChange(event) {
    const row = event.target.closest('tr');
    const id = row.dataset.id;
    const { field } = event.target.dataset;
    let result;

    if (DETAIL_FIELDS.includes(field)) {
        handleDetailChange(row, id);

        return;
    }

    if (field === 'archived') {
        archiveAsset(row, id, event.target.checked);

        return;
    }

    if (field === 'currency') {
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

const shareInput = event => event.target.closest('input[data-class]');
const rowShares = row => Array.from(row.querySelectorAll('input[data-class]'));

function handleShareInput(event) {
    const input = shareInput(event);

    if (input) {
        const row = input.closest('tr');
        row.querySelector('.total').textContent = totalText(rowShares(row).map(i => i.value));
    }
}

// Saves a split once its row adds up to 100% (or is emptied); until then the total is flagged.
function handleShareChange(event) {
    const input = shareInput(event);

    if (!input) {
        return;
    }

    const row = input.closest('tr');
    const raw = Object.fromEntries(rowShares(row).map(i => [i.dataset.class, i.value]));
    const result = row.classList.contains('target') ? setTargets(settings, raw) : setHoldingSplit(settings, input.dataset.row, raw);

    row.querySelector('.total').classList.toggle('bad', !result.ok);
    classesMessage.textContent = result.ok ? '' : `${row.querySelector('th').textContent}: ${result.error} Not saved yet.`;

    if (result.ok) {
        saveData();
        notifyDataChanged();
    }
}

function handleFireInputChange(event) {
    const input = event.target.closest('[data-fire]');

    if (!input) {
        return;
    }

    const field = input.dataset.fire;
    const result = setFireInput(settings, field, input.value);
    fireInputMessage.textContent = result.ok ? '' : result.error;

    // Updated in place so focus stays where the user moved it.
    if (!result.ok) {
        input.value = settings.fire[field] ?? '';

        return;
    }

    saveData();
    notifyDataChanged();
}

function downloadBackup() {
    const now = new Date();
    const backup = buildBackup({ settings, transactions, balances, closedMonths, registeredRoom }, now);
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
    hideArchivedAssetsInput.addEventListener('change', renderAssets);
    newAssetTypeSelect.addEventListener('change', syncNewAssetName);
    classesTable.addEventListener('input', handleShareInput);
    classesTable.addEventListener('change', handleShareChange);
    fireInputs.addEventListener('change', handleFireInputChange);
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
