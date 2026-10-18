// Investments & FIRE tab: renders where you stand, progress, the projection,
// allocation, holdings, registered room and assumptions from the pure model in
// fire.js and registered-room.js. Only registered room is editable here.

import { transactions, balances, closedMonths, settings, registeredRoom } from './state.js';
import {
    fireEmpty, fireRateNote, fireContent, fireStandTitle, fireStats, fireWarning, fireProgress, fireProjectionHint,
    fireProjection, fireAllocation, fireHoldings, fireRoomYear, fireRoom, fireRoomMessage, fireAssumptions
} from './dom.js';
import { buildFire } from './fire.js';
import { roomRows, roomYears, setRoomValue, RRSP_ALLOWANCE } from './registered-room.js';
import { saveRegisteredRoom } from './storage.js';
import { ASSET_CLASSES } from './settings.js';
import { tip } from './explanations.js';
import { escapeHTML, formatMoney, monthLabel, MONTH_NAMES, formatSignedPercent } from './utils.js';
import { BASE_CURRENCY } from './constants.js';

const DASH = '—';
// Below half a dollar, an allocation is on target.
const ON_TARGET = 0.5;

let selectedRoomYear = null;

const money = value => (value === null ? DASH : formatMoney(value));
// Inputs such as 4 or 3.5 shown as typed: "4%", "3.5%".
const inputPercent = value => `${Number(value.toFixed(2))}%`;
const percent = (ratio, decimals = 1) => (ratio === null ? DASH : `${(ratio * 100).toFixed(decimals)}%`);
const shortDate = date => `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;

const spendingSource = model => (model.spendingIsDefault ? 'last 12 months' : 'your amount');

const kpi = (key, label, value, footnote, options) =>
    `<div class="kpi"><span class="k">${tip(key, label, options)}</span><span class="v">${escapeHTML(value)}</span><span class="f">${escapeHTML(footnote)}</span></div>`;

function fiYearKpi(model) {
    if (model.fiNumber === null) {
        return kpi('fiYear', 'FI year', DASH, 'Needs an FI number', { end: true });
    }

    if (model.fiYear === 'reached') {
        return kpi('fiYear', 'FI year', 'Reached', 'The FI portfolio covers the FI number', { end: true });
    }

    if (model.fiYear === null) {
        return kpi('fiYear', 'FI year', `Not reached by ${model.projectionEnd}`, 'See the projection', { end: true });
    }

    return kpi('fiYear', 'FI year', String(model.fiYear), model.fiAge === null ? 'See the projection' : `At age ${model.fiAge} · see the projection`, { end: true });
}

function renderStats(model) {
    const { fire } = settings;
    const source = spendingSource(model);
    const noSpending = model.spendingIsDefault ? 'No spending in the last 12 months' : 'Retirement spending is $0 in Settings';
    const fiNumberNote = model.fiNumber === null
        ? noSpending
        : `${formatMoney(model.spending)} spending (${source}) ÷ (1 − ${inputPercent(fire.withdrawalTax)} tax) ÷ ${inputPercent(fire.swr)}`;

    fireStandTitle.textContent = `Where you stand — balances as of ${monthLabel(model.latestMonth)}`;
    fireStats.innerHTML = [
        kpi('fiPortfolio', 'FI portfolio', formatMoney(model.fiPortfolio), 'All assets except their cash share'),
        kpi('fiNumber', 'FI number', money(model.fiNumber), fiNumberNote),
        kpi('swrToday', 'SWR today', percent(model.swrToday, 2),
            `${formatMoney(model.withdrawal)} withdrawal ÷ FI portfolio · target ${inputPercent(fire.swr)}`),
        fiYearKpi(model)
    ].join('');

    const unclassified = model.holdings.filter(holding => !holding.split).length;
    fireWarning.textContent = unclassified === 0 ? '' : unclassified === 1
        ? '1 asset has no class split, so it counts fully toward the FI portfolio. Give its holding a split in Settings.'
        : `${unclassified} assets have no class split, so they count fully toward the FI portfolio. Give their holdings a split in Settings.`;
}

function freedomCalendar(model) {
    if (!model.freedomLastDay) {
        return 'No days paid for yet';
    }

    if (model.freedomDays >= 365) {
        return `<b>Jan 1 → Dec 31</b> paid for`;
    }

    const next = new Date(model.freedomLastDay);
    next.setDate(next.getDate() + 1);

    return `<b>Jan 1 → ${shortDate(model.freedomLastDay)}</b> paid for · ${shortDate(next)} → Dec 31 needs ${formatMoney(model.stillToFund)} more`;
}

function renderProgress(model) {
    if (model.fiNumber === null) {
        fireProgress.innerHTML = '<p class="hint">No FI number yet: add spending, or set a fixed amount in Settings.</p>';

        return;
    }

    const filled = Math.round(Math.min(Math.max(model.achieved, 0), 1) * 100);

    fireProgress.innerHTML = `
        <div class="progress-line">
            <div class="progress" role="progressbar" aria-label="Progress to FI" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${filled}">
                <div class="progress-fill" style="width:${filled}%"></div>
            </div>
            <span><b>${formatMoney(model.fiPortfolio)}</b> of ${formatMoney(model.fiNumber)}</span>
        </div>
        <div class="fire-figures">
            <span>${tip('fiAchieved', 'FI achieved')} <b>${percent(model.achieved)}</b></span>
            <span>${tip('freedomDays', 'Freedom days')} <b>${model.freedomDays}</b> of 365</span>
            <span>${tip('freedomCalendar', 'Freedom calendar')} ${freedomCalendar(model)}</span>
        </div>`;
}

const ROW_STATES = { actual: 'Actual', open: 'Open', projected: 'Projected' };

function projectionRow(row, latestMonth) {
    const state = ROW_STATES[row.kind] ? `<span class="state">${ROW_STATES[row.kind]}</span>` : '';
    const start = row.kind === 'open'
        ? `<span class="act">${money(row.start)} <span class="when">${MONTH_NAMES[Number(latestMonth.slice(5)) - 1]}</span></span>`
        : money(row.start);
    const taxDrag = row.taxDrag === null ? DASH : formatMoney(-row.taxDrag);
    // Rounded before signing, so a change of a few cents reads $0 rather than +$0 or -$0.
    const rounded = row.change === null ? null : Math.round(row.change);
    const change = rounded === null ? DASH : `${rounded > 0 ? '+' : ''}${formatMoney(rounded)}`;
    const badge = row.fi ? '<span class="fi-badge">FI</span>' : '';
    const strong = text => (row.fi ? `<b>${text}</b>` : text);

    return `<tr class="${row.kind}" data-year="${row.year}">
        <th scope="row" class="y">${row.year}${state}</th>
        <td>${row.age ?? DASH}</td>
        <td class="r">${start}</td>
        <td class="r">${change}</td>
        <td class="r${row.taxDrag ? ' neg' : ''}">${taxDrag}</td>
        <td class="r">${strong(money(row.end))}</td>
        <td class="r">${strong(percent(row.swr, 2))}${badge}</td>
    </tr>`;
}

function renderProjection(model) {
    if (!model.projection?.length) {
        fireProjectionHint.textContent = model.projection
            ? 'No years between the projection start and end years. Check them in Settings.'
            : 'The projection needs an FI number.';
        fireProjection.innerHTML = '';

        return;
    }

    fireProjectionHint.innerHTML = `${tip('rowActual', 'Actual')} years are tinted green, like closed months; `
        + `${tip('rowOpen', 'Open')} and ${tip('rowProjected', 'Projected')} years are in italics, like open months. `
        + 'Projected values are in today’s dollars.';

    const heads = [
        ['colYear', 'Year', ''], ['colAge', 'Age', ''], ['colStart', 'Start', 'r'], ['colChange', 'Change', 'r'],
        ['colTaxDrag', 'Tax drag', 'r'], ['colEnd', 'End', 'r'], ['colSwr', 'SWR', 'r']
    ];

    fireProjection.innerHTML = `<thead><tr>${heads.map(([key, label, cls]) =>
        `<th scope="col" class="${cls}">${tip(key, label, { end: cls === 'r' })}</th>`).join('')}</tr></thead>
        <tbody>${model.projection.map(row => projectionRow(row, model.latestMonth)).join('')}</tbody>`;
}

function toTargetText(amount) {
    if (Math.abs(amount) < ON_TARGET) {
        return 'on target';
    }

    return `${amount > 0 ? 'buy' : 'sell'} ${formatMoney(Math.abs(amount))}`;
}

function allocationRow(row) {
    const bar = `<div class="alloc-bar"><div class="alloc-fill" style="width:${((row.share ?? 0) * 100).toFixed(1)}%"></div>${
        row.target === null ? '' : `<div class="alloc-mark" style="left:${Number((row.target * 100).toFixed(1))}%"></div>`}</div>`;
    const driftClass = row.drift === null || Math.abs(row.drift) < 0.0005 ? '' : row.drift < 0 ? ' neg' : ' pos';

    return `<tr>
        <th scope="row">${escapeHTML(row.label)}</th>
        <td class="r">${formatMoney(row.value)}</td>
        <td class="r">${percent(row.share)}</td>
        <td class="r">${percent(row.target)}</td>
        <td class="r${driftClass}">${formatSignedPercent(row.drift)}</td>
        <td class="r">${row.toTarget === null ? DASH : toTargetText(row.toTarget)}</td>
        <td>${bar}</td>
    </tr>`;
}

function renderAllocation({ allocation }) {
    const unclassified = allocation.unclassified > 0
        ? `<tr class="unclassified"><th scope="row">${tip('unclassified', 'Unclassified')}</th><td class="r">${formatMoney(allocation.unclassified)}</td>${
            `<td class="r">${DASH}</td>`.repeat(4)}<td></td></tr>`
        : '';

    fireAllocation.innerHTML = `<thead><tr>
            <th scope="col">Asset class</th>
            <th scope="col" class="r">${tip('allocCurrent', 'Current')}</th>
            <th scope="col" class="r">${tip('allocShare', 'Current %')}</th>
            <th scope="col" class="r">${tip('allocTarget', 'Target %')}</th>
            <th scope="col" class="r">${tip('allocDrift', 'Drift')}</th>
            <th scope="col" class="r">${tip('allocToTarget', 'To reach target', { end: true })}</th>
            <th scope="col">Current vs target</th>
        </tr></thead>
        <tbody>${allocation.rows.map(allocationRow).join('')}${unclassified}</tbody>`;
}

function splitSummary(split) {
    if (!split) {
        return '<span class="warn-ink">Unclassified</span>';
    }

    const parts = ASSET_CLASSES.filter(({ key }) => split[key]).map(({ key, short }) => [short, split[key]]);

    return parts.length === 1 ? parts[0][0] : parts.map(([short, share]) => `${short} ${share}`).join(' / ');
}

function renderHoldings({ holdings }) {
    fireHoldings.innerHTML = `<thead><tr>
            <th scope="col">Asset</th>
            <th scope="col">${tip('holdingClass', 'Class')}</th>
            <th scope="col" class="r">Balance (CAD)</th>
        </tr></thead>
        <tbody>${holdings.map(({ asset, value, split }) => `<tr>
            <td>${escapeHTML(asset.name)}${asset.currency === BASE_CURRENCY ? '' : `<span class="cur">${escapeHTML(asset.currency)}</span>`}${
                asset.archived ? '<span class="arch">archived</span>' : ''}</td>
            <td>${splitSummary(split)}</td>
            <td class="r">${formatMoney(value)}</td>
        </tr>`).join('')}</tbody>`;
}

const roomInputValue = value => (value === null ? '' : value.toLocaleString('en-CA', { maximumFractionDigits: 2 }));

function leftText({ account, left, warning }) {
    if (left === null) {
        return DASH;
    }

    if (!warning) {
        return formatMoney(left);
    }

    const over = `over by ${formatMoney(warning.amount)}`;

    if (warning.kind === 'over') {
        return `<span class="room-warn">${over}</span>`;
    }

    const allowance = account === 'RRSP' ? `past the ${formatMoney(RRSP_ALLOWANCE)} allowance, ` : '';

    return `<span class="room-warn">${over} — ${allowance}CRA charges 1% a month</span>`;
}

function renderRoom() {
    const years = roomYears(registeredRoom, new Date());

    // roomYears always offers the current year, the default.
    if (!years.includes(selectedRoomYear)) {
        selectedRoomYear = new Date().getFullYear();
    }

    fireRoomYear.innerHTML = years.map(year => `<option value="${year}">${year}</option>`).join('');
    fireRoomYear.value = String(selectedRoomYear);
    fireRoomMessage.textContent = '';

    const rows = roomRows(registeredRoom, settings, selectedRoomYear);

    if (!rows.length) {
        fireRoom.innerHTML = '<tbody><tr><td class="hint">Give RRSP or TFSA assets an owner in Settings to track their room.</td></tr></tbody>';

        return;
    }

    const input = (row, field, label) => `<input type="text" inputmode="decimal" value="${escapeHTML(roomInputValue(row[field]))}"
        data-year="${selectedRoomYear}" data-account="${row.account}" data-person="${escapeHTML(row.person)}" data-field="${field}"
        aria-label="${escapeHTML(`${row.account} ${label} for ${row.person}, ${selectedRoomYear}`)}">`;

    fireRoom.innerHTML = `<thead><tr>
            <th scope="col">Account</th>
            <th scope="col">Person</th>
            <th scope="col" class="r">${tip('roomRoom', 'Room')}</th>
            <th scope="col" class="r">${tip('roomContributed', 'Contributed', { end: true })}</th>
            <th scope="col" class="r">${tip('roomLeft', 'Left', { end: true })}</th>
        </tr></thead>
        <tbody>${rows.map(row => `<tr data-account="${row.account}" data-person="${escapeHTML(row.person)}">
            <td>${row.account}</td>
            <td>${escapeHTML(row.person)}</td>
            <td class="r">${input(row, 'room', 'room')}</td>
            <td class="r">${input(row, 'contributed', 'contributed')}</td>
            <td class="r left">${leftText(row)}</td>
        </tr>`).join('')}</tbody>`;
}

function renderAssumptions(model) {
    const { fire } = settings;
    const spending = `${formatMoney(model.spending)} (${spendingSource(model)})`;
    const automatic = fire.projectionStart === null || fire.projectionEnd === null;
    const firstYear = model.projection?.[0]?.year ?? fire.projectionStart;
    const years = model.projection?.length ? `${firstYear}–${model.projectionEnd}${automatic ? ' (automatic)' : ''}` : DASH;
    // [explanation key, label, value, whether the value is a default worked out from your data]
    const items = [
        ['swr', 'SWR', inputPercent(fire.swr)],
        ['withdrawalTax', 'Withdrawal tax', inputPercent(fire.withdrawalTax)],
        ['spending', 'Retirement spending', spending, model.spendingIsDefault],
        ['yearlySaving', 'Yearly saving', `${formatMoney(model.saved)} (last 12 months, computed)`],
        ['expectedReturn', 'Expected return', inputPercent(fire.expectedReturn)],
        ['inflation', 'Inflation', inputPercent(fire.inflation)],
        ['nonRegTaxDrag', 'Non-reg tax drag', inputPercent(fire.nonRegTaxDrag)],
        ['nonRegShare', 'Non-reg share', `${Math.round(model.nonRegShare * 100)}% (computed)`],
        ['birthYear', 'Birth year', fire.birthYear === null ? DASH : String(fire.birthYear)],
        ['projectionYears', 'Projection years', years, automatic && years !== DASH]
    ];

    fireAssumptions.innerHTML = items.map(([key, label, value, isDefault]) =>
        `<div><dt>${tip(key, label)}</dt><dd${isDefault ? ' class="default"' : ''}>${escapeHTML(value)}</dd></div>`).join('');
}

/** Renders the Investments & FIRE tab from current state. */
export function renderFire() {
    const model = buildFire({ transactions, balances, closedMonths, settings, today: new Date() });

    fireEmpty.hidden = model.latestMonth !== null;
    fireRateNote.textContent = model.missingRates
        ? `Set the ${model.missingRates.join(' and ')} rate${model.missingRates.length > 1 ? 's' : ''} in Settings to see where you stand.`
        : '';
    fireContent.hidden = !model.latestMonth || Boolean(model.missingRates);

    if (fireContent.hidden) {
        return;
    }

    renderStats(model);
    renderProgress(model);
    renderProjection(model);
    renderAllocation(model);
    renderHoldings(model);
    renderRoom();
    renderAssumptions(model);
}

// Saves one room value and updates its row in place, so focus stays where the user moved it.
function handleRoomChange(event) {
    const input = event.target.closest('input[data-field]');

    if (!input) {
        return;
    }

    const target = { year: Number(input.dataset.year), account: input.dataset.account, person: input.dataset.person, field: input.dataset.field };
    const result = setRoomValue(registeredRoom, target, input.value);
    const row = roomRows(registeredRoom, settings, target.year).find(r => r.account === target.account && r.person === target.person);

    if (result.ok) {
        saveRegisteredRoom();
    }

    // Clearing the last value of someone who only had entries that year removes their row.
    if (!row) {
        renderRoom();

        return;
    }

    fireRoomMessage.textContent = result.ok ? '' : result.error;
    input.value = roomInputValue(row[target.field]);
    input.closest('tr').querySelector('.left').innerHTML = leftText(row);
}

/** Wires the Investments & FIRE tab; call once after the DOM is ready. */
export function initFire() {
    fireRoomYear.addEventListener('change', () => {
        selectedRoomYear = Number(fireRoomYear.value);
        renderRoom();
    });
    fireRoom.addEventListener('change', handleRoomChange);
}
