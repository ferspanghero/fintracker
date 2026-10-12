// Balance Sheet tab: renders the yearly grid and indicators from the pure model
// in balance-sheet.js and handles inline balance editing and month actions.

import { transactions, balances, closedMonths, settings } from './state.js';
import { bsYearSelect, bsGrid, bsRateNote, bsMessage, bsIndicatorsTitle, bsIndicators } from './dom.js';
import { saveData } from './storage.js';
import { buildYear, setBalance, copyPreviousMonth, toggleClosed, availableYears } from './balance-sheet.js';
import { escapeHTML } from './utils.js';
import { UNCATEGORIZED } from './category-engine.js';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

let selectedYear = null;

const formatNumber = (value, decimals) =>
    value.toLocaleString('en-CA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const formatMoney = (value, decimals = 0) => `${value < 0 ? '-' : ''}$${formatNumber(Math.abs(value), decimals)}`;
function formatPercent(ratio) {
    if (ratio === null) {
        return '—';
    }

    const rounded = Number((ratio * 100).toFixed(1));

    // Rounding can leave "-0.0"; show an unchanged value without a sign.
    return rounded === 0 ? '0.0%' : `${rounded > 0 ? '+' : ''}${rounded.toFixed(1)}%`;
}
const monthLabel = key => `${MONTH_NAMES[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;

function monthHeader(month, index) {
    const state = month.closed ? 'closed' : 'open';
    let action = '';

    if (month.closed) {
        action = `<button type="button" data-action="toggle-closed">Reopen</button>`;
    } else if (month.hasBalances) {
        action = `<button type="button" data-action="toggle-closed">Close</button>`;
    } else if (month.canCopyPrevious) {
        action = `<button type="button" class="blue" data-action="copy-previous">Copy prev.</button>`;
    }

    return `<th class="m ${state}" data-month="${month.key}">
        <span class="mname">${MONTH_NAMES[index]}</span>
        <span class="state">${month.closed ? '✓ Closed' : 'Open'}</span>${action}
    </th>`;
}

const extraCells = (count = 4) => '<td class="x"></td>'.repeat(count);
const sectionRow = label => `<tr class="section"><td>${label}</td>${'<td></td>'.repeat(16)}</tr>`;

function assetRow(row, model) {
    const { asset } = row;
    const cells = row.values.map((value, i) => {
        const month = model.months[i];
        const tint = month.closed ? ' mc' : '';
        const attrs = `data-month="${month.key}" data-asset="${escapeHTML(asset.id)}"`;

        if (value === null) {
            return `<td class="edit c-empty${tint}" ${attrs} title="Click to enter">·</td>`;
        }

        const cad = row.cad[i] === null || asset.currency === 'CAD' ? '' : ` = CAD ${formatNumber(row.cad[i], 2)}`;
        const title = `${asset.currency} ${formatNumber(value, 2)}${cad}`;

        return `<td class="edit${month.closed ? '' : ' c-open'}${tint}" ${attrs} title="${escapeHTML(title)}">${formatNumber(value, 0)}</td>`;
    }).join('');

    return `<tr>
        <td>${escapeHTML(asset.name)}<span class="cur">${escapeHTML(asset.currency)}</span>${asset.archived ? '<span class="arch">archived</span>' : ''}</td>
        ${cells}${extraCells()}
    </tr>`;
}

function netWorthRow(model) {
    const cells = model.netWorth.map((value, i) => {
        const month = model.months[i];
        let text = '';

        if (value !== null) {
            text = formatMoney(value);
        } else if (month.hasBalances) {
            text = '—';
        }

        return `<td class="${month.closed ? 'mc' : ''}">${text}</td>`;
    }).join('');

    return `<tr class="networth"><td>Net worth (CAD)</td>${cells}${extraCells()}</tr>`;
}

// `upIsGood` colours Diff %: more income is good, more spending is bad.
function flowRow(label, row, model, { className = '', upIsGood = false } = {}) {
    const cells = row.values.map((value, i) =>
        `<td class="${model.months[i].closed ? 'mc' : ''}">${value === null ? '' : formatNumber(value, 2)}</td>`).join('');
    const optional = value => (value === null ? '—' : formatNumber(value, 2));
    let diffClass = '';

    if (row.diffPct) {
        diffClass = (row.diffPct > 0) === upIsGood ? 'positive' : 'negative';
    }

    return `<tr class="${className}">
        <td>${label}</td>${cells}
        <td class="x">${formatNumber(row.total, 2)}</td>
        <td class="x">${optional(row.average)}</td>
        <td class="x">${optional(row.prevAverage)}</td>
        <td class="x ${diffClass}">${formatPercent(row.diffPct)}</td>
    </tr>`;
}

function renderGrid(model, year) {
    const head = `<thead><tr><th>${year}</th>${model.months.map(monthHeader).join('')}
        <th class="x">Total</th><th class="x">Average</th><th class="x">Prev. year avg</th><th class="x">Diff %</th></tr></thead>`;

    const expenseRows = model.expenses.map(row => {
        const warn = row.category === UNCATEGORIZED && row.values.some(Boolean);

        return flowRow(`${escapeHTML(row.category)}${warn ? ' ⚠' : ''}`, row, model, { className: warn ? 'warn' : '' });
    }).join('');

    bsGrid.innerHTML = `${head}<tbody>
        ${sectionRow('Assets (end of month)')}
        ${model.assetRows.map(row => assetRow(row, model)).join('')}
        ${netWorthRow(model)}
        ${sectionRow('Income')}
        ${flowRow('Total income', model.income, model, { upIsGood: true })}
        ${sectionRow('Expenses')}
        ${expenseRows}
        ${flowRow('Total expenses', model.totalExpenses, model, { className: 'strong' })}
        ${flowRow('Net income', model.netIncome, model, { className: 'strong', upIsGood: true })}
    </tbody>`;
}

function renderIndicators(model, year) {
    const ind = model.indicators;
    const optionalMoney = value => (value === null ? '—' : formatMoney(value));
    const kpis = [
        ['Net worth at start of year', optionalMoney(ind.startNetWorth), ind.startMonth ? monthLabel(ind.startMonth) : 'No earlier balances'],
        ['Current net worth', optionalMoney(ind.currentNetWorth), ind.currentMonth ? `${monthLabel(ind.currentMonth)}, latest month with balances` : ''],
        ['Net worth change', ind.change === null ? '—' : `${formatMoney(ind.change)} (${formatPercent(ind.changePct)})`, 'current − start of year'],
        ['Total income', formatMoney(ind.totalIncome), `${year}, all months so far`],
        ['Total expenses', formatMoney(ind.totalExpenses), `${year}, all months so far`],
        ['Total saved', formatMoney(ind.saved), 'income − expenses'],
        ['Investment returns', optionalMoney(ind.returns), 'net worth change − saved over the same months (includes rate effects)'],
        ['Saving rate', ind.savingRate === null ? '—' : `${(ind.savingRate * 100).toFixed(1)}%`, 'saved ÷ income'],
        ['Expense change vs last year', formatPercent(ind.expenseChangePct), 'Average vs prev. year avg']
    ];

    bsIndicatorsTitle.textContent = `Indicators ${year}`;
    bsIndicators.innerHTML = kpis.map(([label, value, footnote]) =>
        `<div class="kpi"><span class="k">${label}</span> <span class="v">${value}</span> <span class="f">${footnote}</span></div>`).join('');
}

/** Renders the year selector, grid and indicators from current state. */
export function renderBalanceSheet() {
    const today = new Date();
    const years = availableYears({ transactions, balances, today });

    if (!years.includes(selectedYear)) {
        selectedYear = today.getFullYear();
    }

    bsYearSelect.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('');
    bsYearSelect.value = String(selectedYear);

    const model = buildYear({ year: selectedYear, transactions, balances, closedMonths, settings, today });
    renderGrid(model, selectedYear);
    renderIndicators(model, selectedYear);
    bsRateNote.textContent = model.missingRates.length ? `Set rates in Settings: ${model.missingRates.join(', ')}.` : '';
}

function saveAndRender() {
    saveData();
    renderBalanceSheet();
}

function startEdit(cell) {
    const { month, asset } = cell.dataset;
    const current = balances[month]?.[asset];
    const input = document.createElement('input');
    let finished = false;

    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = current ?? '';
    input.setAttribute('aria-label', 'Balance');
    cell.textContent = '';
    cell.appendChild(input);
    input.focus();

    const finish = commit => {
        if (finished) {
            return;
        }

        finished = true;
        bsMessage.textContent = '';

        if (commit) {
            const result = setBalance(balances, month, asset, input.value);

            if (!result.ok) {
                bsMessage.textContent = result.error;
                renderBalanceSheet();

                return;
            }

            saveAndRender();

            return;
        }

        renderBalanceSheet();
    };

    input.addEventListener('keydown', event => {
        if (event.key === 'Enter') {
            finish(true);
        } else if (event.key === 'Escape') {
            finish(false);
        }
    });
    input.addEventListener('blur', () => finish(true));
}

function handleGridClick(event) {
    const button = event.target.closest('button[data-action]');

    if (button) {
        const key = button.closest('th').dataset.month;

        if (button.dataset.action === 'toggle-closed') {
            toggleClosed(closedMonths, key);
        } else {
            copyPreviousMonth(balances, key, settings);
        }

        saveAndRender();

        return;
    }

    const cell = event.target.closest('td.edit');

    if (cell && !cell.querySelector('input')) {
        startEdit(cell);
    }
}

/** Wires the year selector and grid; call once after the DOM is ready. */
export function initBalanceSheet() {
    bsYearSelect.addEventListener('change', () => {
        selectedYear = Number(bsYearSelect.value);
        renderBalanceSheet();
    });
    bsGrid.addEventListener('click', handleGridClick);
}
