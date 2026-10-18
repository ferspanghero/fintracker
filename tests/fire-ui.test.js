import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderFire, initFire } from '../js/fire-ui.js';
import { transactions, balances, closedMonths, settings, registeredRoom } from '../js/state.js';
import {
    fireEmpty, fireRateNote, fireContent, fireStandTitle, fireStats, fireWarning, fireProgress, fireProjectionHint,
    fireProjection, fireAllocation, fireHoldings, fireRoomYear, fireRoom, fireRoomMessage, fireAssumptions
} from '../js/dom.js';
import { addAsset, setHoldingSplit, setTargets } from '../js/settings.js';

// Text as shown on screen: balloon explanations left out.
function visibleText(element) {
    const copy = element.cloneNode(true);
    copy.querySelectorAll('.tip-box').forEach(box => box.remove());

    return copy.textContent.replace(/\s+/g, ' ').trim();
}
// The visible label of a term, without its balloon text.
const label = element => (element.querySelector('.tip')?.firstChild ?? element).textContent.trim();
const kpi = name => Array.from(fireStats.querySelectorAll('.kpi')).find(k => label(k.querySelector('.k')) === name);
const value = name => kpi(name).querySelector('.v').textContent;
const footnote = name => kpi(name).querySelector('.f').textContent;
const projectionRow = year => fireProjection.querySelector(`tr[data-year="${year}"]`);
const cells = row => Array.from(row.cells).map(cell => cell.firstChild?.textContent.trim() ?? '');
const allocationRow = name => Array.from(fireAllocation.querySelectorAll('tbody tr')).find(tr => label(tr.cells[0]) === name);
const roomInput = (account, person, field) =>
    fireRoom.querySelector(`input[data-account="${account}"][data-person="${person}"][data-field="${field}"]`);
const change = (element, newValue) => {
    element.value = newValue;
    element.dispatchEvent(new Event('change', { bubbles: true }));
};

function seed() {
    addAsset(settings, 'n', 'CAD', () => 'eq', { type: 'Non-registered', institution: 'Broker', owner: 'Joint', holding: 'ETF1' });
    addAsset(settings, 'n', 'USD', () => 'rrsp', { type: 'RRSP', institution: 'Broker', owner: 'Alex', holding: 'ETF2' });
    addAsset(settings, 'n', 'CAD', () => 'tfsa', { type: 'TFSA', institution: 'Broker', owner: 'Sam', holding: 'ETF1' });
    addAsset(settings, 'n', 'CAD', () => 'cash', { type: 'Savings', institution: 'Bank', owner: 'Joint', holding: 'Cash' });
    settings.rates.USD = 1.5;
    setHoldingSplit(settings, 'ETF1', { usEquity: 100 });
    setHoldingSplit(settings, 'Cash', { cash: 100 });
    Object.assign(settings.fire, { birthYear: 1990, projectionStart: 2025, projectionEnd: 2033 });
    balances['2026-09'] = { eq: 600000, rrsp: 200000, tfsa: 300000, cash: 50000 };
    for (let i = 0; i < 12; i++) {
        const date = new Date(2025, 9 + i, 5);
        transactions.push(
            { date, description: 'Pay', amount: 10000, type: 'income', category: 'Trabalho', account: 'Bank' },
            { date, description: 'Rent', amount: 5000, type: 'expense', category: 'Casa', account: 'Bank' }
        );
    }
}

describe('Investments & FIRE UI', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 9, 17, 12, 0));
        initFire();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('asks for balances when there are none', () => {
        // Act
        renderFire();

        // Assert
        expect(fireEmpty.hidden).toBe(false);
        expect(fireContent.hidden).toBe(true);
        expect(fireRateNote.textContent).toBe('');
    });

    it('asks for the missing rates instead of showing figures', () => {
        // Arrange
        seed();
        settings.rates.USD = null;

        // Act
        renderFire();

        // Assert
        expect(fireContent.hidden).toBe(true);
        expect(fireEmpty.hidden).toBe(true);
        expect(fireRateNote.textContent).toBe('Set the USD rate in Settings to see where you stand.');
    });

    it('names every missing rate', () => {
        // Arrange
        seed();
        settings.rates.USD = null;
        addAsset(settings, 'Real', 'BRL', () => 'brl');
        balances['2026-09'].brl = 1;

        // Act
        renderFire();

        // Assert
        expect(fireRateNote.textContent).toBe('Set the BRL and USD rates in Settings to see where you stand.');
    });

    it('shows where you stand with explained terms', () => {
        // Arrange
        seed();

        // Act
        renderFire();

        // Assert
        expect(fireContent.hidden).toBe(false);
        expect(fireStandTitle.textContent).toBe('Where you stand — balances as of Sep 2026');
        expect(value('FI portfolio')).toBe('$1,200,000');
        expect(value('FI number')).toBe('$1,875,000');
        expect(footnote('FI number')).toBe('$60,000 spending (last 12 months) ÷ (1 − 20% tax) ÷ 4%');
        expect(value('SWR today')).toBe('6.25%');
        expect(footnote('SWR today')).toBe('$75,000 withdrawal ÷ FI portfolio · target 4%');
        expect(value('FI year')).toBe('2032');
        expect(footnote('FI year')).toBe('At age 42 · see the projection');
        expect(fireStats.querySelectorAll('.tip[aria-describedby]')).toHaveLength(4);
    });

    it('shows the progress bar, freedom days and the freedom calendar', () => {
        // Arrange
        seed();

        // Act
        renderFire();
        const bar = fireProgress.querySelector('[role="progressbar"]');

        // Assert
        expect(bar.getAttribute('aria-valuenow')).toBe('64');
        expect(fireProgress.querySelector('.progress-fill').style.width).toBe('64%');
        expect(visibleText(fireProgress)).toContain('$1,200,000 of $1,875,000');
        expect(visibleText(fireProgress)).toContain('64.0%');
        expect(visibleText(fireProgress)).toContain('233 of 365');
        expect(visibleText(fireProgress)).toContain('Jan 1 → Aug 21 paid for · Aug 22 → Dec 31 needs $675,000 more');
    });

    it('shows a whole year paid for and FI reached', () => {
        // Arrange
        seed();
        balances['2026-09'].eq = 5000000;

        // Act
        renderFire();

        // Assert
        expect(value('FI year')).toBe('Reached');
        expect(footnote('FI year')).toBe('The FI portfolio covers the FI number');
        expect(fireProgress.querySelector('.progress-fill').style.width).toBe('100%');
        expect(visibleText(fireProgress)).toContain('Jan 1 → Dec 31 paid for');
    });

    it('says when no day is paid for yet and FI is not reached by the end year', () => {
        // Arrange
        seed();
        balances['2026-09'] = { cash: 1000 };

        // Act
        renderFire();

        // Assert
        expect(visibleText(fireProgress)).toContain('No days paid for yet');
        expect(value('FI year')).toBe('Not reached by 2033');
        expect(value('SWR today')).toBe('—');
    });

    it('explains that there is no FI number without spending', () => {
        // Arrange
        seed();
        transactions.length = 0;

        // Act
        renderFire();

        // Assert
        expect(value('FI number')).toBe('—');
        expect(footnote('FI number')).toBe('No spending in the last 12 months');
        expect(value('FI year')).toBe('—');
        expect(visibleText(fireProgress)).toBe('No FI number yet: add spending, or set a fixed amount in Settings.');
        expect(fireProjection.innerHTML).toBe('');
        expect(fireProjectionHint.textContent).toBe('The projection needs an FI number.');
    });

    it('describes your own retirement spending', () => {
        // Arrange
        seed();
        Object.assign(settings.fire, { retirementSpending: 40000, birthYear: null });

        // Act
        renderFire();
        const spending = Array.from(fireAssumptions.querySelectorAll('dd')).find(dd => dd.textContent.includes('40,000'));

        // Assert
        expect(footnote('FI number')).toBe('$40,000 spending (your amount) ÷ (1 − 20% tax) ÷ 4%');
        expect(footnote('FI year')).toBe('See the projection');
        expect(spending.textContent).toBe('$40,000 (your amount)');
        expect(spending.classList.contains('default')).toBe(false);
        expect(visibleText(fireAssumptions)).toContain('Birth year—');
    });

    it('shows worked-out defaults in grey italics among the assumptions', () => {
        // Arrange
        seed();
        Object.assign(settings.fire, { projectionStart: null, projectionEnd: null });

        // Act
        renderFire();
        const defaults = Array.from(fireAssumptions.querySelectorAll('dd.default')).map(dd => dd.textContent);

        // Assert
        expect(defaults).toEqual(['$60,000 (last 12 months)', '2026–2046 (automatic)']);
    });

    it('says when the retirement spending is set to $0', () => {
        // Arrange
        seed();
        settings.fire.retirementSpending = 0;

        // Act
        renderFire();

        // Assert
        expect(footnote('FI number')).toBe('Retirement spending is $0 in Settings');
    });

    it('says when the projection years leave no rows', () => {
        // Arrange
        seed();
        Object.assign(settings.fire, { projectionStart: 2060, projectionEnd: null });

        // Act
        renderFire();

        // Assert
        expect(fireProjectionHint.textContent).toBe('No years between the projection start and end years. Check them in Settings.');
        expect(fireProjection.innerHTML).toBe('');
        expect(visibleText(fireAssumptions)).toContain('Projection years—');
    });

    it('styles actual, no-data, open and projected years and badges the FI year', () => {
        // Arrange
        seed();
        balances['2025-12'] = { eq: 1000000 };
        closedMonths.push('2025-12');
        Object.assign(settings.fire, { projectionStart: 2024 });

        // Act
        renderFire();

        // Assert
        expect(projectionRow(2024).className).toBe('none');
        expect(cells(projectionRow(2024)).slice(2)).toEqual(['—', '—', '—', '—', '—']);
        expect(projectionRow(2025).className).toBe('actual');
        expect(projectionRow(2025).cells[0].querySelector('.state').textContent).toBe('Actual');
        expect(cells(projectionRow(2025))[4]).toBe('—');
        expect(projectionRow(2026).className).toBe('open');
        expect(projectionRow(2026).cells[2].textContent).toBe('$1,200,000 Sep');
        expect(projectionRow(2027).className).toBe('projected');
        expect(projectionRow(2027).cells[4].textContent).toMatch(/^-\$[\d,]+$/);
        expect(projectionRow(2027).cells[3].textContent).toMatch(/^\+\$[\d,]+$/);
        expect(projectionRow(2032).classList.contains('fi')).toBe(false);
        expect(fireProjection.querySelectorAll('.fi-badge')).toHaveLength(1);
        expect(fireProjection.querySelector('.fi-badge').closest('tr').dataset.year).toBe('2032');
        expect(projectionRow(2032).cells[1].textContent).toBe('42');
        expect(fireProjectionHint.querySelectorAll('.tip')).toHaveLength(3);
        expect(Array.from(fireProjection.querySelectorAll('thead th')).map(label)).toEqual(['Year', 'Age', 'Start', 'Change', 'Tax drag', 'End', 'SWR']);
        expect(fireProjection.querySelectorAll('thead .tip')).toHaveLength(7);
    });

    it('shows allocation against targets with buy and sell amounts', () => {
        // Arrange
        seed();
        setHoldingSplit(settings, 'ETF2', { canadaEquity: 100 });
        setTargets(settings, { canadaEquity: 30, usEquity: 60, cash: 10 });

        // Act
        renderFire();

        // Assert
        expect(cells(allocationRow('Canada Equity')).slice(1, 6)).toEqual(['$300,000', '24.0%', '30.0%', '-6.0%', 'buy $75,000']);
        expect(allocationRow('Canada Equity').cells[4].className).toContain('neg');
        expect(cells(allocationRow('US Equity')).slice(4, 6)).toEqual(['+12.0%', 'sell $150,000']);
        expect(cells(allocationRow('Cash')).slice(4, 6)).toEqual(['-6.0%', 'buy $75,000']);
        expect(cells(allocationRow('Intl Equity')).slice(1, 6)).toEqual(['$0', '—', '—', '—', '—']);
        expect(allocationRow('Canada Equity').querySelector('.alloc-mark').style.left).toBe('30%');
        expect(allocationRow('Unclassified')).toBeUndefined();
    });

    it.each([
        ['nothing left to project in an open December', { '2025-12': { eq: 1200000 } }, [], '$0'],
        ['a finished year that fell', { '2024-12': { eq: 1300000 }, '2025-12': { eq: 1200000 } }, ['2024-12', '2025-12'], '-$100,000'],
        ['a change that rounds to nothing', { '2024-12': { eq: 1200000.4 }, '2025-12': { eq: 1200000 } }, ['2024-12', '2025-12'], '$0']
    ])('shows the change for %s without a misleading sign', (_, months, closed, text) => {
        // Arrange
        seed();
        delete balances['2026-09'];
        Object.assign(balances, months);
        closedMonths.push(...closed);

        // Act
        renderFire();

        // Assert
        expect(projectionRow(2025).cells[3].textContent).toBe(text);
    });

    it('says a class is on target when it holds exactly its share', () => {
        // Arrange
        seed();
        setHoldingSplit(settings, 'ETF2', { canadaEquity: 100 });
        setTargets(settings, { canadaEquity: 24, usEquity: 72, cash: 4 });

        // Act
        renderFire();

        // Assert
        expect(cells(allocationRow('Canada Equity')).slice(4, 6)).toEqual(['0.0%', 'on target']);
    });

    it('shows an Unclassified row and a warning for assets without a split, and no targets as dashes', () => {
        // Arrange
        seed();

        // Act
        renderFire();

        // Assert
        expect(cells(allocationRow('Unclassified')).slice(1, 6)).toEqual(['$300,000', '—', '—', '—', '—']);
        expect(cells(allocationRow('US Equity')).slice(3, 6)).toEqual(['—', '—', '—']);
        expect(allocationRow('US Equity').querySelector('.alloc-mark')).toBeNull();
        expect(fireWarning.textContent).toBe('1 asset has no class split, so it counts fully toward the FI portfolio. Give its holding a split in Settings.');
    });

    it('pluralizes the unclassified warning and clears it when every asset is classified', () => {
        // Arrange
        seed();
        addAsset(settings, 'Loose', 'CAD', () => 'loose');
        balances['2026-09'].loose = 10;
        renderFire();
        const plural = fireWarning.textContent;
        setHoldingSplit(settings, 'ETF2', { usEquity: 100 });
        delete balances['2026-09'].loose;

        // Act
        renderFire();

        // Assert
        expect(plural).toMatch(/^2 assets have no class split, so they count/);
        expect(fireWarning.textContent).toBe('');
    });

    it('lists holdings largest first with their class split and currency', () => {
        // Arrange
        seed();
        settings.assets.find(a => a.id === 'tfsa').archived = true;
        setHoldingSplit(settings, 'ETF1', { usEquity: 60, intlEquity: 40 });

        // Act
        renderFire();
        const rows = Array.from(fireHoldings.querySelectorAll('tbody tr'));

        // Assert
        expect(rows.map(tr => tr.cells[0].textContent)).toEqual([
            'Non-registered Broker - Joint - ETF1',
            'RRSP Broker - Alex - ETF2USD',
            'TFSA Broker - Sam - ETF1archived',
            'Savings Bank - Joint - Cash'
        ]);
        expect(rows[0].cells[1].textContent).toBe('US 60 / Intl 40');
        expect(rows[1].cells[1].textContent).toBe('Unclassified');
        expect(rows[1].cells[2].textContent).toBe('$300,000');
        expect(rows[3].cells[1].textContent).toBe('Cash');
    });

    it('lists room per account and person for the current year', () => {
        // Arrange
        seed();
        registeredRoom.push({ year: 2026, account: 'RRSP', person: 'Alex', room: 30000, contributed: 31500 });

        // Act
        renderFire();

        // Assert
        expect(Array.from(fireRoomYear.options).map(o => o.value)).toEqual(['2026']);
        expect(Array.from(fireRoom.querySelectorAll('tbody tr')).map(tr => [tr.cells[0].textContent, tr.cells[1].textContent])).toEqual([
            ['RRSP', 'Alex'], ['TFSA', 'Sam']
        ]);
        expect(roomInput('RRSP', 'Alex', 'room').value).toBe('30,000');
        expect(fireRoom.querySelector('tr[data-person="Alex"] .left').textContent).toBe('over by $1,500');
        expect(fireRoom.querySelector('tr[data-person="Sam"] .left').textContent).toBe('—');
    });

    it('saves a room value without rebuilding the table and updates what is left', () => {
        // Arrange
        seed();
        renderFire();
        const input = roomInput('TFSA', 'Sam', 'room');

        // Act
        change(input, '7000');
        change(roomInput('TFSA', 'Sam', 'contributed'), '7,100');

        // Assert
        expect(roomInput('TFSA', 'Sam', 'room')).toBe(input);
        expect(input.value).toBe('7,000');
        expect(registeredRoom).toEqual([{ year: 2026, account: 'TFSA', person: 'Sam', room: 7000, contributed: 7100 }]);
        expect(JSON.parse(localStorage.getItem('registeredRoom'))).toEqual(registeredRoom);
        expect(fireRoom.querySelector('tr[data-person="Sam"] .left').textContent).toBe('over by $100 — CRA charges 1% a month');
        expect(fireRoom.querySelector('tr[data-person="Sam"] .left .room-warn')).not.toBeNull();
        expect(localStorage.getItem('transactions')).toBeNull();
    });

    it('shows the RRSP allowance warning past $2,000 over', () => {
        // Arrange
        seed();
        renderFire();

        // Act
        change(roomInput('RRSP', 'Alex', 'room'), '1000');
        change(roomInput('RRSP', 'Alex', 'contributed'), '3001');

        // Assert
        expect(fireRoom.querySelector('tr[data-person="Alex"] .left').textContent)
            .toBe('over by $2,001 — past the $2,000 allowance, CRA charges 1% a month');
    });

    it('rejects an invalid room value and puts the stored one back', () => {
        // Arrange
        seed();
        registeredRoom.push({ year: 2026, account: 'TFSA', person: 'Sam', room: 7000, contributed: null });
        renderFire();
        const input = roomInput('TFSA', 'Sam', 'room');

        // Act
        change(input, '-5');

        // Assert
        expect(fireRoomMessage.textContent).toBe('Enter an amount of 0 or more.');
        expect(input.value).toBe('7,000');
        expect(registeredRoom[0].room).toBe(7000);
    });

    it('clears the message after a valid change and ignores changes outside the inputs', () => {
        // Arrange
        seed();
        renderFire();
        change(roomInput('TFSA', 'Sam', 'room'), 'x');

        // Act
        fireRoom.dispatchEvent(new Event('change', { bubbles: true }));
        change(roomInput('TFSA', 'Sam', 'room'), '');

        // Assert
        expect(fireRoomMessage.textContent).toBe('');
        expect(registeredRoom).toEqual([]);
    });

    it('switches the room table to the year picked', () => {
        // Arrange
        seed();
        registeredRoom.push({ year: 2024, account: 'TFSA', person: 'Pat', room: 500, contributed: 0 });
        renderFire();

        // Act
        change(fireRoomYear, '2024');
        renderFire();

        // Assert
        expect(fireRoomYear.value).toBe('2024');
        expect(fireRoom.querySelector('tr[data-person="Pat"] .left').textContent).toBe('$500');
        expect(roomInput('TFSA', 'Pat', 'room').dataset.year).toBe('2024');
    });

    it('drops the row of someone whose only entry that year is cleared', () => {
        // Arrange
        seed();
        registeredRoom.push({ year: 2026, account: 'TFSA', person: 'Pat', room: 500, contributed: null });
        renderFire();

        // Act
        change(roomInput('TFSA', 'Pat', 'room'), '');

        // Assert
        expect(registeredRoom).toEqual([]);
        expect(fireRoom.querySelector('tr[data-person="Pat"]')).toBeNull();
        expect(JSON.parse(localStorage.getItem('registeredRoom'))).toEqual([]);
    });

    it('explains how to get room rows when nobody holds a registered account', () => {
        // Arrange
        addAsset(settings, 'Plain', 'CAD', () => 'p');
        balances['2026-09'] = { p: 1 };

        // Act
        renderFire();

        // Assert
        expect(fireRoom.textContent).toBe('Give RRSP or TFSA assets an owner in Settings to track their room.');
    });

    it('summarizes the assumptions with the computed non-registered share', () => {
        // Arrange
        seed();

        // Act
        renderFire();

        // Assert
        const text = visibleText(fireAssumptions);
        expect(text).toContain('SWR4%');
        expect(text).toContain('Withdrawal tax20%');
        expect(text).toContain('Retirement spending$60,000 (last 12 months)');
        expect(text).toContain('Expected return7%');
        expect(text).toContain('Inflation2%');
        expect(text).toContain('Non-reg tax drag10%');
        expect(text).toContain('Non-reg share50% (computed)');
        expect(text).toContain('Birth year1990');
        expect(text).toContain('Projection years2025–2033');
        expect(text).toContain('Yearly saving$60,000 (last 12 months, computed)');
        expect(fireAssumptions.querySelectorAll('.tip')).toHaveLength(10);
    });

    it('describes automatic projection years', () => {
        // Arrange
        seed();
        Object.assign(settings.fire, { projectionStart: null, projectionEnd: null });

        // Act
        renderFire();

        // Assert
        expect(visibleText(fireAssumptions)).toContain('Projection years2026–2046 (automatic)');
    });
});
