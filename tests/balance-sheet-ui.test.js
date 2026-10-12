import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderBalanceSheet, initBalanceSheet } from '../js/balance-sheet-ui.js';
import { transactions, balances, closedMonths, settings } from '../js/state.js';
import { bsGrid, bsYearSelect, bsMessage, bsRateNote, bsIndicators, bsIndicatorsTitle } from '../js/dom.js';
import { UNCATEGORIZED } from '../js/category-engine.js';

const addAsset = (id, currency, archived = false) => settings.assets.push({ id, name: id, currency, archived });
const headerFor = key => bsGrid.querySelector(`th[data-month="${key}"]`);
const cellFor = (key, assetId) => bsGrid.querySelector(`td[data-month="${key}"][data-asset="${assetId}"]`);
const rowNamed = label => Array.from(bsGrid.querySelectorAll('tbody tr')).find(tr => tr.cells[0].textContent.startsWith(label));
const press = (target, key, options = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options });
    target.dispatchEvent(event);

    return event;
};
// Opens the editor on a cell with its current value, as F2 does.
const openEditor = (key, assetId) => press(cellFor(key, assetId), 'F2');

function editCell(key, assetId, value, keyName = 'Enter') {
    openEditor(key, assetId);
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
        vi.restoreAllMocks();
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
        openEditor('2026-09', 'a');
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

    describe('clicking while a balance is being edited', () => {
        const mouseDown = target => {
            const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
            target.dispatchEvent(event);

            return event;
        };

        beforeEach(() => {
            addAsset('a', 'CAD');
            addAsset('b', 'CAD');
            balances['2026-09'] = { a: 5, b: 1 };
            renderBalanceSheet();
            openEditor('2026-09', 'a');
            cellFor('2026-09', 'a').querySelector('input').value = '7';
        });

        it('keeps focus in the input so the click reaches its target', () => {
            // Act
            const down = mouseDown(headerFor('2026-09').querySelector('button'));

            // Assert
            expect(down.defaultPrevented).toBe(true);
        });

        it('lets a press inside the input behave normally', () => {
            // Act
            const down = mouseDown(cellFor('2026-09', 'a').querySelector('input'));

            // Assert
            expect(down.defaultPrevented).toBe(false);
        });

        it('saves the edit and applies a month action in one click', () => {
            // Act
            mouseDown(headerFor('2026-09').querySelector('button'));
            headerFor('2026-09').querySelector('button').click();

            // Assert
            expect(balances['2026-09'].a).toBe(7);
            expect(closedMonths).toEqual(['2026-09']);
        });

        it('saves the edit and selects another cell in one click', () => {
            // Act
            mouseDown(cellFor('2026-09', 'b'));
            cellFor('2026-09', 'b').click();

            // Assert
            expect(balances['2026-09'].a).toBe(7);
            expect(cellFor('2026-09', 'b').querySelector('input')).toBeNull();
            expect(document.activeElement).toBe(cellFor('2026-09', 'b'));
        });

        it('skips the action when the edited value is invalid', () => {
            // Arrange
            cellFor('2026-09', 'a').querySelector('input').value = 'abc';

            // Act
            headerFor('2026-09').querySelector('button').click();

            // Assert
            expect(bsMessage.textContent).toBe('Enter a number, or leave it blank to clear.');
            expect(closedMonths).toEqual([]);
        });
    });

    it('keeps editing when the input itself is clicked', () => {
        // Arrange
        addAsset('a', 'CAD');
        renderBalanceSheet();
        openEditor('2026-09', 'a');
        const input = cellFor('2026-09', 'a').querySelector('input');

        // Act
        input.click();

        // Assert
        expect(cellFor('2026-09', 'a').querySelector('input')).toBe(input);
    });

    it('ignores clicks on cells that are not editable', () => {
        // Arrange
        addAsset('a', 'CAD');
        renderBalanceSheet();
        const before = bsGrid.innerHTML;

        // Act
        rowNamed('Net worth').cells[1].click();

        // Assert
        expect(bsGrid.innerHTML).toBe(before);
    });

    it('saves only once when the input blurs after Enter', () => {
        // Arrange
        addAsset('a', 'CAD');
        renderBalanceSheet();
        openEditor('2026-09', 'a');
        const input = cellFor('2026-09', 'a').querySelector('input');
        input.value = '3';
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        const setItem = vi.spyOn(Storage.prototype, 'setItem');

        // Act
        input.dispatchEvent(new Event('blur'));

        // Assert
        expect(setItem).not.toHaveBeenCalled();
        expect(balances['2026-09']).toEqual({ a: 3 });
    });

    describe('when saving an edit removes the row or the year', () => {
        const showYear = year => {
            bsYearSelect.value = String(year);
            bsYearSelect.dispatchEvent(new Event('change'));
        };
        const startEditing = (key, assetId, value) => {
            openEditor(key, assetId);
            cellFor(key, assetId).querySelector('input').value = value;
        };

        it('does not select a cell in a row that disappeared', () => {
            // Arrange
            addAsset('a', 'CAD');
            addAsset('b', 'CAD');
            balances['2025-03'] = { a: 5, b: 1 };
            renderBalanceSheet();
            showYear(2025);
            startEditing('2025-03', 'a', '');

            // Act
            const click = () => cellFor('2025-04', 'a').click();

            // Assert
            expect(click).not.toThrow();
            expect(cellFor('2025-04', 'a')).toBeNull();
            expect(bsGrid.querySelector('td.edit input')).toBeNull();
            expect(balances['2025-03']).toEqual({ b: 1 });
        });

        it('skips a month action when its year is no longer shown', () => {
            // Arrange
            addAsset('a', 'CAD');
            balances['2025-03'] = { a: 5 };
            renderBalanceSheet();
            showYear(2025);
            startEditing('2025-03', 'a', '');

            // Act
            headerFor('2025-03').querySelector('button').click();

            // Assert
            expect(balances).toEqual({});
            expect(closedMonths).toEqual([]);
        });

        it('moves focus to the year selector when Enter saves away the edited row', () => {
            // Arrange
            addAsset('a', 'CAD');
            addAsset('b', 'CAD');
            balances['2025-03'] = { a: 5, b: 1 };
            renderBalanceSheet();
            showYear(2025);
            startEditing('2025-03', 'a', '');

            // Act
            cellFor('2025-03', 'a').querySelector('input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

            // Assert
            expect(document.activeElement).toBe(bsYearSelect);
        });
    });

    it('keeps editing when the padding around the open input is clicked', () => {
        // Arrange
        addAsset('a', 'CAD');
        renderBalanceSheet();
        openEditor('2026-09', 'a');
        const input = cellFor('2026-09', 'a').querySelector('input');
        input.value = 'abc';

        // Act
        cellFor('2026-09', 'a').click();

        // Assert
        expect(cellFor('2026-09', 'a').querySelector('input')).toBe(input);
        expect(bsMessage.textContent).toBe('');
    });

    it('moves focus to the cell that Tab was heading to after saving', () => {
        // Arrange
        addAsset('a', 'CAD');
        renderBalanceSheet();
        openEditor('2026-09', 'a');
        const input = cellFor('2026-09', 'a').querySelector('input');
        input.value = '4';

        // Act
        input.dispatchEvent(new FocusEvent('blur', { relatedTarget: cellFor('2026-10', 'a') }));

        // Assert
        expect(balances['2026-09']).toEqual({ a: 4 });
        expect(document.activeElement).toBe(cellFor('2026-10', 'a'));
    });

    it('moves focus to the month button that Tab was heading to after saving', () => {
        // Arrange
        addAsset('a', 'CAD');
        balances['2026-09'] = { a: 5 };
        renderBalanceSheet();
        openEditor('2026-09', 'a');
        const input = cellFor('2026-09', 'a').querySelector('input');

        // Act
        input.dispatchEvent(new FocusEvent('blur', { relatedTarget: headerFor('2026-10').querySelector('button') }));

        // Assert
        expect(document.activeElement).toBe(headerFor('2026-10').querySelector('button'));
    });

    it('does not intercept presses when nothing is being edited', () => {
        // Arrange
        addAsset('a', 'CAD');
        balances['2026-09'] = { a: 5 };
        renderBalanceSheet();
        const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

        // Act
        headerFor('2026-09').querySelector('button').dispatchEvent(down);

        // Assert
        expect(down.defaultPrevented).toBe(false);
    });

    describe('keyboard and screen readers', () => {
        beforeEach(() => {
            addAsset('a', 'CAD');
            balances['2026-09'] = { a: 5 };
            renderBalanceSheet();
        });

        it('labels the grid and its row and column headers', () => {
            // Act
            renderBalanceSheet();

            // Assert
            expect(bsGrid.getAttribute('aria-label')).toBe('Balance Sheet 2026');
            expect(headerFor('2026-09').getAttribute('scope')).toBe('col');
            expect(rowNamed('a').cells[0].tagName).toBe('TH');
            expect(rowNamed('a').cells[0].getAttribute('scope')).toBe('row');
            expect(rowNamed('Total income').cells[0].getAttribute('scope')).toBe('row');
        });

        it('makes balance cells focusable and describes them', () => {
            // Act
            renderBalanceSheet();

            // Assert
            expect(cellFor('2026-09', 'a').tabIndex).toBe(0);
            expect(cellFor('2026-09', 'a').getAttribute('aria-label')).toBe('a, Sep 2026: CAD 5.00');
            expect(cellFor('2026-10', 'a').getAttribute('aria-label')).toBe('a, Oct 2026: empty');
        });
    });

    describe('spreadsheet-style selection and editing', () => {
        const pressed = key => press(document.activeElement, key);
        const select = (key, assetId) => cellFor(key, assetId).focus();

        beforeEach(() => {
            addAsset('a', 'CAD');
            addAsset('b', 'CAD');
            balances['2026-09'] = { a: 5, b: 1 };
            renderBalanceSheet();
        });

        it('selects a clicked cell without opening an editor', () => {
            // Act
            cellFor('2026-09', 'a').click();

            // Assert
            expect(document.activeElement).toBe(cellFor('2026-09', 'a'));
            expect(cellFor('2026-09', 'a').querySelector('input')).toBeNull();
        });

        it('edits the current value on double-click, with the caret at the end', () => {
            // Act
            cellFor('2026-09', 'a').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

            // Assert
            const input = cellFor('2026-09', 'a').querySelector('input');
            expect(input).not.toBeNull();
            expect(document.activeElement).toBe(input);
            expect(input.value).toBe('5');
            expect(input.selectionStart).toBe(1);
        });

        it('ignores a double-click inside the open editor', () => {
            // Arrange
            openEditor('2026-09', 'a');
            const input = cellFor('2026-09', 'a').querySelector('input');
            input.value = '12';

            // Act
            input.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

            // Assert
            expect(cellFor('2026-09', 'a').querySelector('input')).toBe(input);
            expect(input.value).toBe('12');
        });

        it('edits the current value on F2', () => {
            // Arrange
            select('2026-09', 'a');

            // Act
            pressed('F2');

            // Assert
            const input = cellFor('2026-09', 'a').querySelector('input');
            expect(document.activeElement).toBe(input);
            expect(input.value).toBe('5');
        });

        it('starts an edit that replaces the value when a character is typed', () => {
            // Arrange
            select('2026-09', 'a');

            // Act
            const event = pressed('7');

            // Assert
            const input = cellFor('2026-09', 'a').querySelector('input');
            expect(event.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(input);
            expect(input.value).toBe('7');
            expect(input.selectionStart).toBe(1);
        });

        it('saves a typed value with Enter', () => {
            // Arrange
            select('2026-09', 'a');
            pressed('7');

            // Act
            pressed('Enter');

            // Assert
            expect(balances['2026-09'].a).toBe(7);
        });

        it.each([
            ['Ctrl', { ctrlKey: true }],
            ['Meta', { metaKey: true }],
            ['Alt', { altKey: true }],
            ['an IME composition', { isComposing: true }]
        ])('leaves a key alone when typed with %s', (_, options) => {
            // Arrange
            select('2026-09', 'a');

            // Act
            const event = press(cellFor('2026-09', 'a'), 'c', options);

            // Assert
            expect(event.defaultPrevented).toBe(false);
            expect(cellFor('2026-09', 'a').querySelector('input')).toBeNull();
        });

        it('leaves keys alone on grid elements other than a selected cell', () => {
            // Arrange
            const button = headerFor('2026-09').querySelector('button');
            button.focus();

            // Act
            const event = press(button, 'ArrowRight');

            // Assert
            expect(event.defaultPrevented).toBe(false);
            expect(document.activeElement).toBe(button);
        });

        it.each([['Space', ' '], ['a non-breaking space', '\u00a0']])('leaves %s alone so it cannot clear a balance', (_, key) => {
            // Arrange
            select('2026-09', 'a');

            // Act
            const event = pressed(key);

            // Assert
            expect(event.defaultPrevented).toBe(false);
            expect(cellFor('2026-09', 'a').querySelector('input')).toBeNull();
            expect(balances['2026-09'].a).toBe(5);
        });

        it('clears a past year\'s only balance and moves focus to the year selector when its row disappears', () => {
            // Arrange
            addAsset('old', 'CAD');
            balances['2025-03'] = { old: 2 };
            renderBalanceSheet();
            bsYearSelect.value = '2025';
            bsYearSelect.dispatchEvent(new Event('change'));
            select('2025-03', 'old');

            // Act
            pressed('Delete');

            // Assert
            expect(balances['2025-03']).toBeUndefined();
            expect(document.activeElement).toBe(bsYearSelect);
        });

        it('ignores a double-click on another cell while an edit is open', () => {
            // Arrange
            openEditor('2026-09', 'a');
            const input = cellFor('2026-09', 'a').querySelector('input');

            // Act
            cellFor('2026-09', 'b').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

            // Assert
            expect(cellFor('2026-09', 'b').querySelector('input')).toBeNull();
            expect(document.activeElement).toBe(input);
        });

        it('takes the cell being edited out of the Tab order so Shift+Tab leaves it', () => {
            // Act
            openEditor('2026-09', 'a');
            const whileEditing = cellFor('2026-09', 'a').tabIndex;
            pressed('Escape');

            // Assert
            expect(whileEditing).toBe(-1);
            expect(cellFor('2026-09', 'a').tabIndex).toBe(0);
        });

        it.each(['Enter', 'ArrowDown'])('keeps focus on the cell when %s saves an invalid value', key => {
            // Arrange
            openEditor('2026-09', 'a');
            cellFor('2026-09', 'a').querySelector('input').value = 'x';

            // Act
            pressed(key);

            // Assert
            expect(bsMessage.textContent).toBe('Enter a number, or leave it blank to clear.');
            expect(document.activeElement).toBe(cellFor('2026-09', 'a'));
        });

        it('keeps focus on the cell when Tab saves an invalid value', () => {
            // Arrange
            openEditor('2026-09', 'a');
            const input = cellFor('2026-09', 'a').querySelector('input');
            input.value = 'x';

            // Act
            input.dispatchEvent(new FocusEvent('blur', { relatedTarget: cellFor('2026-10', 'a') }));

            // Assert
            expect(document.activeElement).toBe(cellFor('2026-09', 'a'));
        });

        it('lets Enter confirm an IME composition without saving', () => {
            // Arrange
            openEditor('2026-09', 'a');
            const input = cellFor('2026-09', 'a').querySelector('input');
            input.value = '8';

            // Act
            const event = press(input, 'Enter', { isComposing: true });

            // Assert
            expect(event.defaultPrevented).toBe(false);
            expect(cellFor('2026-09', 'a').querySelector('input')).toBe(input);
            expect(balances['2026-09'].a).toBe(5);
        });

        it.each(['Delete', 'Backspace'])('clears the selected balance with %s and keeps it selected', key => {
            // Arrange
            select('2026-09', 'a');

            // Act
            pressed(key);

            // Assert
            expect(balances['2026-09']).toEqual({ b: 1 });
            expect(JSON.parse(localStorage.getItem('balances'))).toEqual({ '2026-09': { b: 1 } });
            expect(cellFor('2026-09', 'a').textContent).toBe('·');
            expect(document.activeElement).toBe(cellFor('2026-09', 'a'));
        });

        it('treats an asset id that names a built-in object property as having no balance', () => {
            // Arrange
            addAsset('constructor', 'CAD');
            renderBalanceSheet();
            const setItem = vi.spyOn(Storage.prototype, 'setItem');

            // Act
            select('2026-09', 'constructor');
            pressed('Delete');
            pressed('F2');

            // Assert
            expect(setItem).not.toHaveBeenCalled();
            expect(cellFor('2026-09', 'constructor').querySelector('input').value).toBe('');
        });

        it('does nothing on Delete when the selected cell is empty', () => {
            // Arrange
            select('2026-10', 'a');
            const setItem = vi.spyOn(Storage.prototype, 'setItem');

            // Act
            pressed('Delete');

            // Assert
            expect(setItem).not.toHaveBeenCalled();
        });

        it.each([
            ['ArrowRight', '2026-10', 'a'],
            ['ArrowLeft', '2026-08', 'a'],
            ['ArrowDown', '2026-09', 'b'],
            ['Enter', '2026-09', 'b']
        ])('moves the selection with %s without redrawing the grid', (key, month, asset) => {
            // Arrange
            select('2026-09', 'a');
            const selected = cellFor('2026-09', 'a');

            // Act
            const event = pressed(key);

            // Assert
            expect(event.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(cellFor(month, asset));
            expect(selected.isConnected).toBe(true);
        });

        it.each([
            ['ArrowUp', {}],
            ['Enter', { shiftKey: true }]
        ])('moves the selection up with %s', (key, options) => {
            // Arrange
            select('2026-09', 'b');

            // Act
            press(cellFor('2026-09', 'b'), key, options);

            // Assert
            expect(document.activeElement).toBe(cellFor('2026-09', 'a'));
        });

        it.each([
            ['ArrowLeft', '2026-01', 'a'],
            ['ArrowRight', '2026-12', 'a'],
            ['ArrowUp', '2026-09', 'a'],
            ['ArrowDown', '2026-09', 'b']
        ])('keeps the selection at the edge of the grid on %s', (key, month, asset) => {
            // Arrange
            select(month, asset);

            // Act
            const event = pressed(key);

            // Assert
            expect(event.defaultPrevented).toBe(true);
            expect(document.activeElement).toBe(cellFor(month, asset));
        });

        it.each([
            ['Enter', {}, '2026-09', 'b'],
            ['ArrowDown', {}, '2026-09', 'b']
        ])('saves an edit and moves down with %s', (key, options, month, asset) => {
            // Arrange
            openEditor('2026-09', 'a');
            cellFor('2026-09', 'a').querySelector('input').value = '8';

            // Act
            press(document.activeElement, key, options);

            // Assert
            expect(balances['2026-09'].a).toBe(8);
            expect(document.activeElement).toBe(cellFor(month, asset));
        });

        it.each([
            ['Enter', { shiftKey: true }],
            ['ArrowUp', {}]
        ])('saves an edit and moves up with %s', (key, options) => {
            // Arrange
            openEditor('2026-09', 'b');
            cellFor('2026-09', 'b').querySelector('input').value = '9';

            // Act
            press(document.activeElement, key, options);

            // Assert
            expect(balances['2026-09'].b).toBe(9);
            expect(document.activeElement).toBe(cellFor('2026-09', 'a'));
        });

        it('stays on the cell when Enter saves an edit in the bottom row', () => {
            // Arrange
            openEditor('2026-09', 'b');
            cellFor('2026-09', 'b').querySelector('input').value = '9';

            // Act
            pressed('Enter');

            // Assert
            expect(balances['2026-09'].b).toBe(9);
            expect(document.activeElement).toBe(cellFor('2026-09', 'b'));
        });

        it.each(['ArrowLeft', 'ArrowRight'])('keeps editing on %s so the caret can move', key => {
            // Arrange
            openEditor('2026-09', 'a');
            const input = cellFor('2026-09', 'a').querySelector('input');

            // Act
            const event = press(input, key);

            // Assert
            expect(event.defaultPrevented).toBe(false);
            expect(cellFor('2026-09', 'a').querySelector('input')).toBe(input);
        });

        it('cancels an edit on Escape and keeps the cell selected', () => {
            // Arrange
            openEditor('2026-09', 'a');
            cellFor('2026-09', 'a').querySelector('input').value = '8';

            // Act
            pressed('Escape');

            // Assert
            expect(balances['2026-09'].a).toBe(5);
            expect(cellFor('2026-09', 'a').textContent).toBe('5');
            expect(cellFor('2026-09', 'a').classList.contains('editing')).toBe(false);
            expect(document.activeElement).toBe(cellFor('2026-09', 'a'));
        });

        it('leaves storage and the grid alone when an edit ends unchanged', () => {
            // Arrange
            openEditor('2026-09', 'a');
            const row = rowNamed('a');
            const setItem = vi.spyOn(Storage.prototype, 'setItem');

            // Act
            pressed('ArrowDown');

            // Assert
            expect(setItem).not.toHaveBeenCalled();
            expect(row.isConnected).toBe(true);
            expect(cellFor('2026-09', 'a').textContent).toBe('5');
            expect(cellFor('2026-09', 'a').classList.contains('editing')).toBe(false);
            expect(document.activeElement).toBe(cellFor('2026-09', 'b'));
        });

        it('clears the message from a rejected edit when a later edit ends unchanged', () => {
            // Arrange
            editCell('2026-09', 'a', 'abc');
            openEditor('2026-09', 'a');

            // Act
            pressed('Escape');

            // Assert
            expect(bsMessage.textContent).toBe('');
        });
    });

    describe('saving from the grid', () => {
        const savedKeys = setItem => setItem.mock.calls.map(([key]) => key);

        beforeEach(() => {
            addAsset('a', 'CAD');
            addAsset('b', 'CAD');
            balances['2026-08'] = { a: 4 };
            balances['2026-09'] = { a: 5, b: 1 };
            renderBalanceSheet();
        });

        it.each([
            ['an edit', () => editCell('2026-09', 'a', '6'), () => expect(balances['2026-09'].a).toBe(6)],
            ['a cleared balance', () => press(cellFor('2026-09', 'a'), 'Delete'), () => expect(balances['2026-09']).toEqual({ b: 1 })],
            ['a month action', () => headerFor('2026-09').querySelector('button').click(), () => expect(closedMonths).toEqual(['2026-09'])],
            ['a copied month', () => headerFor('2026-10').querySelector('button').click(), () => expect(balances['2026-10']).toEqual({ a: 5, b: 1 })]
        ])('writes only the balance sheet after %s', (_, act, assertApplied) => {
            // Arrange
            const setItem = vi.spyOn(Storage.prototype, 'setItem');

            // Act
            act();

            // Assert
            assertApplied();
            expect(savedKeys(setItem)).toEqual(['balances', 'closedMonths']);
        });

        it('rebuilds only the rows whose content changed', () => {
            // Arrange
            const untouched = { assetRow: rowNamed('b'), expenseRow: rowNamed('Casa'), headerRow: bsGrid.tHead.rows[0] };
            const edited = rowNamed('a');
            const netWorth = rowNamed('Net worth');

            // Act
            editCell('2026-09', 'a', '6');

            // Assert
            expect(untouched.assetRow.isConnected).toBe(true);
            expect(untouched.expenseRow.isConnected).toBe(true);
            expect(untouched.headerRow.isConnected).toBe(true);
            expect(edited.isConnected).toBe(false);
            expect(netWorth.isConnected).toBe(false);
            expect(cellFor('2026-09', 'a').textContent).toBe('6');
            expect(rowNamed('Net worth').cells[9].textContent).toBe('$7');
        });

        it('removes the editor of a rejected value even though its row did not change', () => {
            // Act
            editCell('2026-09', 'a', 'abc');

            // Assert
            expect(bsGrid.querySelector('input')).toBeNull();
            expect(bsGrid.querySelector('.editing')).toBeNull();
            expect(cellFor('2026-09', 'a').tabIndex).toBe(0);
            expect(cellFor('2026-09', 'a').textContent).toBe('5');
        });

        it('rebuilds the header when a month gains its first balance', () => {
            // Arrange
            const header = bsGrid.tHead.rows[0];

            // Act
            editCell('2026-10', 'a', '2');

            // Assert
            expect(header.isConnected).toBe(false);
            expect(headerFor('2026-10').querySelector('button').textContent).toBe('Close');
        });

        it('drops rows that no longer exist and adds new ones', () => {
            // Arrange
            settings.categories.expense = ['Pets', UNCATEGORIZED];

            // Act
            renderBalanceSheet();

            // Assert
            expect(rowNamed('Casa')).toBeUndefined();
            expect(rowNamed('Pets')).toBeTruthy();
            expect(bsGrid.tBodies).toHaveLength(1);
            expect(bsGrid.tHead.rows).toHaveLength(1);
        });

        it.each([
            ['an edit', () => editCell('2026-09', 'a', '6')],
            ['a removed row', () => {
                balances['2025-03'] = { a: 2, b: 3 };
                renderBalanceSheet();
                bsYearSelect.value = '2025';
                bsYearSelect.dispatchEvent(new Event('change'));
                editCell('2025-03', 'a', '');
            }],
            ['an inserted row', () => {
                settings.assets.unshift({ id: 'new', name: 'new', currency: 'CAD', archived: false });
                renderBalanceSheet();
            }],
            ['a year switch', () => {
                balances['2025-03'] = { a: 2 };
                renderBalanceSheet();
                bsYearSelect.value = '2025';
                bsYearSelect.dispatchEvent(new Event('change'));
            }]
        ])('shows the same grid as a render from scratch after %s', (_, change) => {
            // Arrange
            change();
            const patched = bsGrid.innerHTML;

            // Act
            bsGrid.innerHTML = '';
            renderBalanceSheet();

            // Assert
            expect(bsGrid.innerHTML).toBe(patched);
        });
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
