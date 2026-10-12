import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderBalanceSheet, initBalanceSheet } from '../js/balance-sheet-ui.js';
import { transactions, balances, closedMonths, settings } from '../js/state.js';
import { bsGrid, bsYearSelect, bsMessage, bsRateNote, bsIndicators, bsIndicatorsTitle } from '../js/dom.js';
import { UNCATEGORIZED } from '../js/category-engine.js';

const addAsset = (id, currency, archived = false) => settings.assets.push({ id, name: id, currency, archived });
const headerFor = key => bsGrid.querySelector(`th[data-month="${key}"]`);
const cellFor = (key, assetId) => bsGrid.querySelector(`td[data-month="${key}"][data-asset="${assetId}"]`);
const rowNamed = label => Array.from(bsGrid.querySelectorAll('tbody tr')).find(tr => tr.cells[0].textContent.startsWith(label));

function editCell(key, assetId, value, keyName = 'Enter') {
    cellFor(key, assetId).click();
    const input = cellFor(key, assetId).querySelector('input');
    input.value = value;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true }));
}

describe('balance sheet UI', () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(2026, 9, 11, 12, 0));
        initBalanceSheet();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('lists available years and selects the current one', () => {
        // Arrange
        balances['2025-03'] = {};

        // Act
        renderBalanceSheet();

        // Assert
        expect(Array.from(bsYearSelect.options).map(o => o.value)).toEqual(['2026', '2025']);
        expect(bsYearSelect.value).toBe('2026');
        expect(bsIndicatorsTitle.textContent).toBe('Indicators 2026');
    });

    it('re-renders for the year picked in the selector', () => {
        // Arrange
        addAsset('a', 'CAD');
        balances['2025-03'] = { a: 7 };
        renderBalanceSheet();

        // Act
        bsYearSelect.value = '2025';
        bsYearSelect.dispatchEvent(new Event('change'));

        // Assert
        expect(bsGrid.querySelector('thead th').textContent).toBe('2025');
        expect(cellFor('2025-03', 'a').textContent).toBe('7');
    });

    it('marks closed and open months with their actions', () => {
        // Arrange
        addAsset('a', 'CAD');
        balances['2026-01'] = { a: 1 };
        balances['2026-02'] = { a: 1 };
        closedMonths.push('2026-01');

        // Act
        renderBalanceSheet();

        // Assert
        expect(headerFor('2026-01').classList.contains('closed')).toBe(true);
        expect(headerFor('2026-01').textContent).toContain('✓ Closed');
        expect(headerFor('2026-01').querySelector('button').textContent).toBe('Reopen');
        expect(headerFor('2026-02').textContent).toContain('Open');
        expect(headerFor('2026-02').querySelector('button').textContent).toBe('Close');
        expect(headerFor('2026-03').querySelector('button').textContent).toBe('Copy prev.');
        expect(headerFor('2026-04').querySelector('button')).toBeNull();
    });

    it('shows balances in whole units with exact and CAD values on hover', () => {
        // Arrange
        addAsset('u', 'USD');
        settings.rates.USD = 1.5;
        balances['2026-01'] = { u: 1234.56 };

        // Act
        renderBalanceSheet();

        // Assert
        expect(cellFor('2026-01', 'u').textContent).toBe('1,235');
        expect(cellFor('2026-01', 'u').title).toBe('USD 1,234.56 = CAD 1,851.84');
        expect(rowNamed('Net worth').cells[1].textContent).toBe('$1,852');
    });

    it('saves an edited balance on Enter', () => {
        // Arrange
        addAsset('u', 'USD');
        settings.rates.USD = 1.5;
        renderBalanceSheet();

        // Act
        editCell('2026-09', 'u', '100');

        // Assert
        expect(balances['2026-09']).toEqual({ u: 100 });
        expect(JSON.parse(localStorage.getItem('balances'))).toEqual({ '2026-09': { u: 100 } });
        expect(cellFor('2026-09', 'u').textContent).toBe('100');
        expect(rowNamed('Net worth').cells[9].textContent).toBe('$150');
    });

    it('saves an edited balance when the input loses focus', () => {
        // Arrange
        addAsset('a', 'CAD');
        renderBalanceSheet();
        cellFor('2026-09', 'a').click();
        const input = cellFor('2026-09', 'a').querySelector('input');

        // Act
        input.value = '42';
        input.dispatchEvent(new Event('blur'));

        // Assert
        expect(balances['2026-09']).toEqual({ a: 42 });
    });

    it('clears a balance left blank', () => {
        // Arrange
        addAsset('a', 'CAD');
        balances['2026-09'] = { a: 5 };
        renderBalanceSheet();

        // Act
        editCell('2026-09', 'a', '');

        // Assert
        expect(balances).toEqual({});
        expect(rowNamed('Net worth').cells[9].textContent).toBe('');
    });

    it('rejects invalid input with a message and keeps the old value', () => {
        // Arrange
        addAsset('a', 'CAD');
        balances['2026-09'] = { a: 5 };
        renderBalanceSheet();

        // Act
        editCell('2026-09', 'a', 'abc');

        // Assert
        expect(bsMessage.textContent).toBe('Enter a number, or leave it blank to clear.');
        expect(balances['2026-09']).toEqual({ a: 5 });
        expect(cellFor('2026-09', 'a').textContent).toBe('5');
    });

    it('cancels an edit on Escape', () => {
        // Arrange
        addAsset('a', 'CAD');
        balances['2026-09'] = { a: 5 };
        renderBalanceSheet();

        // Act
        editCell('2026-09', 'a', '99', 'Escape');

        // Assert
        expect(balances['2026-09']).toEqual({ a: 5 });
        expect(cellFor('2026-09', 'a').textContent).toBe('5');
    });

    it('closes and reopens a month', () => {
        // Arrange
        addAsset('a', 'CAD');
        balances['2026-09'] = { a: 5 };
        renderBalanceSheet();

        // Act
        headerFor('2026-09').querySelector('button').click();
        const afterClose = headerFor('2026-09').textContent;
        headerFor('2026-09').querySelector('button').click();

        // Assert
        expect(afterClose).toContain('✓ Closed');
        expect(closedMonths).toEqual([]);
        expect(headerFor('2026-09').textContent).toContain('Open');
        expect(JSON.parse(localStorage.getItem('closedMonths'))).toEqual([]);
    });

    it('copies the previous month into an empty month', () => {
        // Arrange
        addAsset('a', 'CAD');
        addAsset('old', 'CAD', true);
        balances['2026-08'] = { a: 5, old: 1 };
        renderBalanceSheet();

        // Act
        headerFor('2026-09').querySelector('button').click();

        // Assert
        expect(balances['2026-09']).toEqual({ a: 5 });
        expect(cellFor('2026-09', 'a').textContent).toBe('5');
    });

    it('notes missing rates and shows a dash for affected months', () => {
        // Arrange
        addAsset('u', 'USD');
        balances['2026-01'] = { u: 5 };

        // Act
        renderBalanceSheet();

        // Assert
        expect(rowNamed('Net worth').cells[1].textContent).toBe('—');
        expect(bsRateNote.textContent).toBe('Set rates in Settings: USD.');
    });

    it('highlights Sem Categoria when it has spending', () => {
        // Arrange
        transactions.push({ date: new Date(2026, 8, 1), description: 'x', amount: 3, type: 'expense', category: UNCATEGORIZED, account: 'A' });

        // Act
        renderBalanceSheet();

        // Assert
        expect(rowNamed(UNCATEGORIZED).classList.contains('warn')).toBe(true);
        expect(rowNamed('Casa').classList.contains('warn')).toBe(false);
    });

    it('shows one expense row per Settings category plus totals and averages', () => {
        // Arrange
        settings.categories.expense = ['Pets', UNCATEGORIZED];
        transactions.push({ date: new Date(2026, 0, 1), description: 'x', amount: 100, type: 'expense', category: 'Pets', account: 'A' });
        transactions.push({ date: new Date(2026, 1, 1), description: 'x', amount: 200, type: 'expense', category: 'Pets', account: 'A' });
        transactions.push({ date: new Date(2025, 0, 1), description: 'x', amount: 100, type: 'expense', category: 'Pets', account: 'A' });
        closedMonths.push('2025-01', '2026-01', '2026-02');

        // Act
        renderBalanceSheet();

        // Assert
        const pets = rowNamed('Pets');
        const cells = Array.from(pets.cells).map(c => c.textContent);
        expect(cells.slice(1, 3)).toEqual(['100.00', '200.00']);
        expect(cells.slice(13)).toEqual(['300.00', '150.00', '100.00', '+50.0%']);
        expect(pets.cells[16].classList.contains('negative')).toBe(true);
        expect(rowNamed('Total expenses')).toBeTruthy();
        expect(rowNamed('Net income')).toBeTruthy();
    });

    it('shows a change that rounds to zero without a sign', () => {
        // Arrange
        transactions.push({ date: new Date(2026, 0, 1), description: 'x', amount: 1000, type: 'expense', category: 'Casa', account: 'A' });
        transactions.push({ date: new Date(2025, 0, 1), description: 'x', amount: 1000.1, type: 'expense', category: 'Casa', account: 'A' });
        closedMonths.push('2025-01', '2026-01');

        // Act
        renderBalanceSheet();

        // Assert
        expect(rowNamed('Total expenses').cells[16].textContent).toBe('0.0%');
    });

    it('renders the indicators', () => {
        // Arrange
        addAsset('a', 'CAD');
        balances['2025-12'] = { a: 1000 };
        balances['2026-04'] = { a: 1200 };
        transactions.push({ date: new Date(2026, 0, 1), description: 'x', amount: 500, type: 'income', category: 'Trabalho', account: 'A' });
        transactions.push({ date: new Date(2026, 1, 1), description: 'x', amount: 200, type: 'expense', category: 'Casa', account: 'A' });

        // Act
        renderBalanceSheet();

        // Assert
        const text = bsIndicators.textContent.replace(/\s+/g, ' ');
        expect(text).toContain('Net worth change $200 (+20.0%)');
        expect(text).toContain('Total saved $300');
        expect(text).toContain('Investment returns -$100');
        expect(text).toContain('Saving rate 60.0%');
    });

    it('escapes asset names', () => {
        // Arrange
        settings.assets.push({ id: 'x', name: '<img src=x onerror=alert(1)>', currency: 'CAD', archived: false });

        // Act
        renderBalanceSheet();

        // Assert
        expect(bsGrid.querySelector('img')).toBeNull();
        expect(bsGrid.textContent).toContain('<img src=x onerror=alert(1)>');
    });
});
