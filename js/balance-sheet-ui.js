// Balance Sheet tab: renders the yearly grid and indicators from the pure model
// in balance-sheet.js, and handles month actions and spreadsheet-style balance
// editing: a focused cell is the selection; arrows move it, typing, F2 or a
// double-click edit it, and Delete clears it.

import { transactions, balances, closedMonths, settings } from './state.js';
import { bsYearSelect, bsGrid, bsRateNote, bsMessage, bsIndicatorsTitle, bsIndicators } from './dom.js';
import { saveBalanceSheet } from './storage.js';
import { buildYear, setBalance, copyPreviousMonth, toggleClosed, availableYears } from './balance-sheet.js';
import { escapeHTML, MONTH_NAMES, formatNumber, formatMoney, monthLabel, formatSignedPercent as formatPercent } from './utils.js';
import { UNCATEGORIZED } from './category-engine.js';
import { BASE_CURRENCY } from './constants.js';

let selectedYear = null;
// The balance being edited: { input, finish(commit, focusAfter) → whether it saved cleanly }.
let activeEdit = null;

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

    return `<th scope="col" class="m ${state}" data-month="${month.key}">
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
        const label = text => `aria-label="${escapeHTML(`${asset.name}, ${monthLabel(month.key)}: ${text}`)}"`;
        const attrs = `data-month="${month.key}" data-asset="${escapeHTML(asset.id)}" tabindex="0"`;

        if (value === null) {
            return `<td class="edit c-empty${tint}" ${attrs} ${label('empty')} title="Select and type to enter">·</td>`;
        }

        const cad = row.cad[i] === null || asset.currency === BASE_CURRENCY ? '' : ` = ${BASE_CURRENCY} ${formatNumber(row.cad[i], 2)}`;
        const title = `${asset.currency} ${formatNumber(value, 2)}${cad}`;

        return `<td class="edit${month.closed ? '' : ' c-open'}${tint}" ${attrs} ${label(title)} title="${escapeHTML(title)}">${formatNumber(value, 0)}</td>`;
    }).join('');

    return `<tr>
        <th scope="row">${escapeHTML(asset.name)}<span class="cur">${escapeHTML(asset.currency)}</span>${asset.archived ? '<span class="arch">archived</span>' : ''}</th>
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

    return `<tr class="networth"><th scope="row">Net worth (${BASE_CURRENCY})</th>${cells}${extraCells()}</tr>`;
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
        <th scope="row">${label}</th>${cells}
        <td class="x">${formatNumber(row.total, 2)}</td>
        <td class="x">${optional(row.average)}</td>
        <td class="x">${optional(row.prevAverage)}</td>
        <td class="x ${diffClass}">${formatPercent(row.diffPct)}</td>
    </tr>`;
}

// Each grid row remembers the markup it was built from, so a re-render replaces only
// the rows that changed: one edit touches its asset row and net worth, not the whole table.
const builtFrom = new WeakMap();

function updateRows(section, rows) {
    const template = document.createElement('template');

    rows.forEach((html, i) => {
        const current = section.rows[i];

        // A row is reused only when untouched since it was built. The editor is the one
        // in-place change to a row (a rejected value leaves its data the same), so any
        // other in-place change to cells must be undone or also force a rebuild here.
        if (current && builtFrom.get(current) === html && !current.querySelector('.editing')) {
            return;
        }

        template.innerHTML = html;
        const fresh = template.content.firstElementChild;
        builtFrom.set(fresh, html);

        if (current) {
            current.replaceWith(fresh);
        } else {
            section.appendChild(fresh);
        }
    });

    while (section.rows.length > rows.length) {
        section.rows[rows.length].remove();
    }
}

function renderGrid(model, year) {
    bsGrid.setAttribute('aria-label', `Balance Sheet ${year}`);
    const head = `<tr><th scope="col">${year}</th>${model.months.map(monthHeader).join('')}
        <th class="x">Total</th><th class="x">Average</th><th class="x">Prev. year avg</th><th class="x">Diff %</th></tr>`;

    const expenseRows = model.expenses.map(row => {
        const warn = row.category === UNCATEGORIZED && row.values.some(Boolean);

        return flowRow(`${escapeHTML(row.category)}${warn ? ' ⚠' : ''}`, row, model, { className: warn ? 'warn' : '' });
    });

    if (!bsGrid.tHead || bsGrid.tBodies.length !== 1) {
        bsGrid.innerHTML = '<thead></thead><tbody></tbody>';
    }

    updateRows(bsGrid.tHead, [head]);
    updateRows(bsGrid.tBodies[0], [
        sectionRow('Assets (end of month)'),
        ...model.assetRows.map(row => assetRow(row, model)),
        netWorthRow(model),
        sectionRow('Income'),
        flowRow('Total income', model.income, model, { upIsGood: true }),
        sectionRow('Expenses'),
        ...expenseRows,
        flowRow('Total expenses', model.totalExpenses, model, { className: 'strong' }),
        flowRow('Net income', model.netIncome, model, { className: 'strong', upIsGood: true })
    ]);
    // A focused cell scrolls clear of the sticky first column instead of under it.
    bsGrid.parentElement.style.scrollPaddingLeft = `${bsGrid.querySelector('thead th').offsetWidth}px`;
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
    // A render replaces any open editor's input, so that edit is over.
    activeEdit = null;
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
    saveBalanceSheet();
    renderBalanceSheet();
}

// Matched on dataset values so any asset id works without selector escaping.
const cellFor = (month, asset) =>
    [...bsGrid.querySelectorAll('td.edit')].find(td => td.dataset.month === month && td.dataset.asset === asset);
const monthButtonFor = (month, action) =>
    bsGrid.querySelector(`th[data-month="${month}"] button[data-action="${action}"]`);
// The stored balance for a cell; own properties only, so an asset id such as "constructor" reads as empty.
const storedBalance = (month, asset) => (Object.hasOwn(balances[month] ?? {}, asset) ? balances[month][asset] : undefined);
// The cell to focus after a save: the same cell, or the year selector when saving removed its row.
const cellOrYear = (month, asset) => cellFor(month, asset) ?? bsYearSelect;

// The balance cell `rows` asset rows and `months` columns away, or null past the grid's edge.
function neighbourOf(month, asset, rows, months) {
    const monthKeys = [...bsGrid.querySelectorAll('thead th[data-month]')].map(th => th.dataset.month);
    const assetIds = [...new Set([...bsGrid.querySelectorAll('td.edit')].map(td => td.dataset.asset))];
    const monthIndex = monthKeys.indexOf(month);
    const assetIndex = assetIds.indexOf(asset);

    if (monthIndex === -1 || assetIndex === -1) {
        return null;
    }

    const nextMonth = monthKeys[monthIndex + months];
    const nextAsset = assetIds[assetIndex + rows];

    return nextMonth && nextAsset ? cellFor(nextMonth, nextAsset) : null;
}

// Keys that move the selection, as [asset rows, months]; Enter moves down and Shift+Enter up.
const ARROW_MOVES = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
const enterMove = event => [event.shiftKey ? -1 : 1, 0];
const hasShortcutModifier = event => event.ctrlKey || event.metaKey || event.altKey;

// Remembers a grid cell or month button by its data, so the matching element can be
// found again after a re-render replaces the grid. Null for anything else.
function relocator(element) {
    if (!(element instanceof Element) || !bsGrid.contains(element)) {
        return null;
    }

    const cell = element.closest('td.edit');

    if (cell) {
        const { month, asset } = cell.dataset;

        return () => cellFor(month, asset);
    }

    const button = element.closest('button[data-action]');

    if (button) {
        const { month } = button.closest('th').dataset;
        const { action } = button.dataset;

        return () => monthButtonFor(month, action);
    }

    return null;
}

// Opens an editor in the cell holding its current value, or `typed` when a key started the edit.
function startEdit(cell, typed = null) {
    const { month, asset } = cell.dataset;
    const current = storedBalance(month, asset);
    const initial = current === undefined ? '' : String(current);
    const input = document.createElement('input');

    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = typed ?? initial;
    input.setAttribute('aria-label', cell.getAttribute('aria-label'));
    // The editor covers the cell's text, which stays (hidden) so the column keeps its width.
    cell.classList.add('editing');
    // Out of the Tab order while editing, so Shift+Tab from the editor reaches the previous cell.
    cell.tabIndex = -1;
    cell.appendChild(input);

    // Commits or cancels once; returns whether the edit was saved (or cancelled) cleanly.
    // `focusAfter` finds the element to focus afterwards, if any; a rejected value keeps
    // focus on its cell instead. An unchanged or cancelled edit just puts the cell back;
    // a change saves and re-renders the grid.
    const finish = (commit, focusAfter = null) => {
        if (activeEdit?.input !== input) {
            return true;
        }

        activeEdit = null;
        bsMessage.textContent = '';

        if (!commit || input.value === initial) {
            cell.classList.remove('editing');
            cell.tabIndex = 0;
            input.remove();
            focusAfter?.()?.focus();

            return true;
        }

        const result = setBalance(balances, month, asset, input.value);

        if (result.ok) {
            saveBalanceSheet();
        } else {
            bsMessage.textContent = result.error;
        }

        renderBalanceSheet();
        (result.ok ? focusAfter?.() : cellOrYear(month, asset))?.focus();

        return result.ok;
    };

    activeEdit = { input, finish };
    input.addEventListener('keydown', event => handleEditorKey(event, { month, asset, finish }));
    // Tab to another cell or month button: a re-render replaces that element, so focus its successor.
    input.addEventListener('blur', event => finish(true, relocator(event.relatedTarget)));
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
}

// Escape cancels; Enter and Up/Down save and move to the cell above or below, staying put at the edge.
// Left/Right move the caret. Keys that confirm an IME composition are left to the browser.
function handleEditorKey(event, { month, asset, finish }) {
    if (event.isComposing) {
        return;
    }

    if (event.key === 'Escape') {
        finish(false, () => cellOrYear(month, asset));
    } else if (event.key === 'Enter' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault();
        const rows = event.key === 'Enter' ? enterMove(event)[0] : ARROW_MOVES[event.key][0];
        finish(true, () => neighbourOf(month, asset, rows, 0) ?? cellOrYear(month, asset));
    }
}

function clearBalance(cell) {
    const { month, asset } = cell.dataset;

    if (storedBalance(month, asset) === undefined) {
        return;
    }

    bsMessage.textContent = '';
    setBalance(balances, month, asset, '');
    saveAndRender();
    // Clearing a past year's only balance removes its row.
    cellOrYear(month, asset).focus();
}

// A press on a grid button or another cell would blur the input, and the re-render
// on blur would replace the element before its click fires. Keeping focus in the
// input lets the click arrive; handleGridClick then saves the edit first.
function handleGridMouseDown(event) {
    if (activeEdit && !activeEdit.input.contains(event.target) && event.target.closest('button[data-action], td.edit')) {
        event.preventDefault();
    }
}

function handleGridClick(event) {
    const button = event.target.closest('button[data-action]');
    const cell = button ? null : event.target.closest('td.edit');

    // Nothing to do, or a click inside the cell being edited (the input or its padding).
    if ((!button && !cell) || cell?.contains(activeEdit?.input)) {
        return;
    }

    // Read the target before saving the open edit: saving re-renders the grid.
    const { month, asset } = (button?.closest('th') ?? cell).dataset;

    if (activeEdit && !activeEdit.finish(true)) {
        return;
    }

    // Saving can remove the clicked row (its only balance in a past year was cleared)
    // or switch the grid to another year (that was the year's last data).
    if (cell) {
        cellFor(month, asset)?.focus();

        return;
    }

    if (!bsGrid.querySelector(`th[data-month="${month}"]`)) {
        return;
    }

    if (button.dataset.action === 'toggle-closed') {
        toggleClosed(closedMonths, month);
    } else {
        copyPreviousMonth(balances, month, settings);
    }

    saveAndRender();
}

function handleGridDoubleClick(event) {
    const cell = event.target.closest('td.edit');

    if (cell && !activeEdit) {
        startEdit(cell);
    }
}

// Keys on the selected cell itself; keys typed into an open editor are handled by startEdit.
function handleGridKeyDown(event) {
    const cell = event.target;

    if (!cell.matches('td.edit') || hasShortcutModifier(event)) {
        return;
    }

    const move = event.key === 'Enter' ? enterMove(event) : ARROW_MOVES[event.key];

    if (move) {
        event.preventDefault();
        neighbourOf(cell.dataset.month, cell.dataset.asset, ...move)?.focus();
    } else if (event.key === 'F2') {
        event.preventDefault();
        startEdit(cell);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        clearBalance(cell);
    } else if (event.key.length === 1 && event.key.trim() && !event.isComposing) {
        // A typed character starts an edit that replaces the value, as in a spreadsheet.
        // Spaces keep their browser meaning: an edit holding only a space would clear the balance.
        event.preventDefault();
        startEdit(cell, event.key);
    }
}

/** Wires the year selector and grid; call once after the DOM is ready. */
export function initBalanceSheet() {
    bsYearSelect.addEventListener('change', () => {
        selectedYear = Number(bsYearSelect.value);
        renderBalanceSheet();
    });
    bsGrid.addEventListener('mousedown', handleGridMouseDown);
    bsGrid.addEventListener('click', handleGridClick);
    bsGrid.addEventListener('dblclick', handleGridDoubleClick);
    bsGrid.addEventListener('keydown', handleGridKeyDown);
}
