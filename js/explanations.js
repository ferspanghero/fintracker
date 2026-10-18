// Plain-language explanations for the Investments & FIRE terms, shown as hover
// balloons on the tab and beside the FIRE inputs in Settings. A term shows its
// balloon after a short hover or on keyboard focus; Escape hides it.

import { escapeHTML } from './utils.js';

export const EXPLANATIONS = Object.freeze({
    fiPortfolio: 'Everything you own that counts toward retirement: your investments and real estate. The cash share of each holding is left out.',
    fiNumber: 'How much you need so that withdrawing your SWR each year pays for your spending and the tax on what you withdraw. Reach it and work becomes optional.',
    swrToday: 'If you retired today, the share of your portfolio you would have to withdraw each year to live. At or below your SWR is considered safe; higher means not there yet.',
    fiYear: 'The year your portfolio is projected to reach the FI number if you keep saving like the last 12 months. See the projection below.',
    fiAchieved: 'How far along you are: FI portfolio ÷ FI number. 100% means you could retire today.',
    freedomDays: 'How many days of a year your portfolio could already pay for: FI achieved × 365.',
    freedomCalendar: 'Freedom days shown as dates: if your portfolio paid your bills from Jan 1, the money would last through this day.',
    rowActual: 'A finished year: its December is closed on the Balance Sheet. Start and end are the December FI portfolios, and saved is that year’s income minus expenses. Nothing here is estimated.',
    rowOpen: 'The current year: it starts from your latest month with balances, and only the remaining months are projected.',
    rowProjected: 'Estimated from your latest balances with the assumptions below. Recalculated whenever you enter new balances; a year turns actual once you close its December.',
    colYear: 'Each row is one year, from the projection start year to its end year in Settings.',
    colAge: 'Your age at the end of that year, from the birth year in Settings.',
    colStart: 'What the portfolio was, or is expected to be, worth at the start of the year.',
    colGrowth: 'Projected years: the expected return minus inflation, in today’s dollars. Actual years: what the portfolio really gained, apart from the money you added.',
    colTaxDrag: 'Projected years only: a deliberately high guess at the yearly tax on non-registered growth, so the plan errs on the side of saving more than needed.',
    colSaved: 'Actual years: that year’s income minus expenses. Projected years: the last 12 months, repeated (only the remaining months for the current year).',
    colEnd: 'Start + growth − tax drag + saved. It becomes next year’s start.',
    colSwr: 'The withdrawal rate if you retired at the end of that year. FI is reached once it drops to your SWR or below.',
    allocCurrent: 'What you hold in this class today, in CAD.',
    allocShare: 'This class’s share of everything with a class split. Funds that cover several regions are split across classes by their own percentages.',
    allocTarget: 'The share you want this class to have, set in Settings. A class with no target is left out of the percentages; 0% means you want none of it.',
    allocDrift: 'Current % minus target %. Negative means you hold less than you want; positive means more.',
    allocToTarget: 'How much to buy or sell in this class to land exactly on the target today.',
    unclassified: 'Assets whose holding has no class split yet. They still count toward the FI portfolio; give the holding a split in Settings to place them.',
    holdingClass: 'What the holding invests in, from its class split in Settings.',
    roomRoom: 'How much you are allowed to put in this year. RRSP: from your notice of assessment. TFSA: from CRA My Account.',
    roomContributed: 'What went in this year. A spousal RRSP contribution counts against the room of whoever paid it.',
    roomLeft: 'Room minus contributed. CRA charges 1% a month on RRSP excess above $2,000 and on any TFSA excess.',
    swr: 'Safe withdrawal rate: the share of the portfolio you plan to take out each year in retirement. 4% is the classic rule of thumb.',
    withdrawalTax: 'Average tax on what you withdraw in retirement, across RRSP (fully taxed), TFSA (tax-free) and non-registered (half of gains taxed).',
    spending: 'What you expect to spend a year in retirement. Left blank, it is your expenses over the 12 months up to your latest balances, shown in grey; type an amount to use that instead, and clear it to go back.',
    expectedReturn: 'Average yearly growth you expect from your investments, before inflation.',
    inflation: 'Average yearly rise in prices. It is taken off the return so the projection stays in today’s dollars.',
    nonRegTaxDrag: 'A cautious guess at the yearly tax on growth in non-registered accounts: half the gain taxed at about 20%. Kept high on purpose so you over-save rather than fall short.',
    nonRegShare: 'Worked out from your accounts, not typed: the non-registered part of the FI portfolio. Only this share of growth gets the tax drag.',
    birthYear: 'Used only to show your age in the projection.',
    projectionYears: 'The first and last years the projection shows. Left blank, they are the first year with balances and 20 years from now, shown in grey.'
});

let nextId = 0;
let wired = false;

/**
 * Markup for a term with a hover balloon: a focusable span described by its role="tooltip" child.
 * @param {string} key a key of EXPLANATIONS
 * @param {string} label the visible term (escaped here)
 * @param {{end?: boolean, extra?: string}} [options] `end` opens the balloon toward the left, for terms near
 *        the right edge; `extra` is appended to the explanation (e.g. the value a default currently works out to)
 * @returns {string}
 */
export function tip(key, label, { end = false, extra = '' } = {}) {
    if (!Object.hasOwn(EXPLANATIONS, key)) {
        throw new Error(`No explanation for "${key}".`);
    }

    const id = `tip-${++nextId}`;

    return `<span class="tip${end ? ' end' : ''}" tabindex="0" aria-describedby="${id}">${escapeHTML(label)}`
        + `<span class="tip-box" role="tooltip" id="${id}">${escapeHTML([EXPLANATIONS[key], extra].filter(Boolean).join(' '))}</span></span>`;
}

// Entering or leaving a term un-hides its balloon; moving between a term and its own balloon is neither.
function restore(event) {
    const term = event.target.closest?.('.tip');

    if (term && !term.contains(event.relatedTarget)) {
        term.classList.remove('tip-dismissed');
    }
}

/** Wires Escape to hide open balloons; call once after the DOM is ready (later calls do nothing). */
export function initTips() {
    if (wired) {
        return;
    }

    wired = true;
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            document.querySelectorAll('.tip').forEach(term => term.classList.add('tip-dismissed'));
        }
    });
    ['mouseover', 'mouseout', 'focusin', 'focusout'].forEach(type => document.addEventListener(type, restore));
}
