import { describe, it, expect } from 'vitest';
import { EXPLANATIONS, tip, initTips } from '../js/explanations.js';

const render = html => {
    document.body.insertAdjacentHTML('beforeend', `<div id="tips">${html}</div>`);

    return document.getElementById('tips');
};

describe('tip', () => {
    it('marks the term as focusable and links it to its explanation', () => {
        // Arrange
        const host = render(tip('fiNumber', 'FI number'));

        // Act
        const term = host.querySelector('.tip');
        const box = document.getElementById(term.getAttribute('aria-describedby'));

        // Assert
        expect(term.tabIndex).toBe(0);
        expect(term.firstChild.textContent).toBe('FI number');
        expect(box.getAttribute('role')).toBe('tooltip');
        expect(box.textContent).toBe(EXPLANATIONS.fiNumber);
        expect(term.contains(box)).toBe(true);
    });

    it('gives every explanation its own id', () => {
        // Arrange, Act
        const host = render(tip('fiNumber', 'A') + tip('fiNumber', 'B'));
        const ids = Array.from(host.querySelectorAll('[role="tooltip"]')).map(box => box.id);

        // Assert
        expect(new Set(ids).size).toBe(2);
    });

    it('escapes the label and can open its balloon toward the left', () => {
        // Arrange, Act
        const host = render(tip('swr', '<b>SWR</b>', { end: true }));

        // Assert
        expect(host.querySelector('b')).toBeNull();
        expect(host.querySelector('.tip').classList.contains('end')).toBe(true);
    });

    it('adds extra text after the explanation', () => {
        // Arrange, Act
        const host = render(tip('spending', 'Spending', { extra: 'Right now that is $5.' }));

        // Assert
        expect(host.querySelector('[role="tooltip"]').textContent).toBe(`${EXPLANATIONS.spending} Right now that is $5.`);
    });

    it('rejects a term without an explanation', () => {
        // Act, Assert
        expect(() => tip('nope', 'x')).toThrow('No explanation for "nope".');
    });

    it('has plain-language text for every term', () => {
        // Act, Assert
        Object.values(EXPLANATIONS).forEach(text => expect(text.length).toBeGreaterThan(20));
    });
});

describe('initTips', () => {
    it('hides balloons on Escape until the pointer or focus leaves that term', () => {
        // Arrange
        initTips();
        initTips();
        const host = render(tip('fiNumber', 'FI number') + tip('swr', 'SWR'));
        const [first, second] = host.querySelectorAll('.tip');

        // Act
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const dismissed = [first, second].map(t => t.classList.contains('tip-dismissed'));
        first.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

        // Assert
        expect(dismissed).toEqual([true, true]);
        expect(first.classList.contains('tip-dismissed')).toBe(false);
        expect(second.classList.contains('tip-dismissed')).toBe(true);
    });

    it('lets another term open its balloon after Escape hid the one in use', () => {
        // Arrange
        initTips();
        const host = render(tip('fiNumber', 'FI number') + tip('swr', 'SWR'));
        const [first, second] = host.querySelectorAll('.tip');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        // Act
        second.dispatchEvent(new MouseEvent('mouseover', { bubbles: true, relatedTarget: first }));
        first.dispatchEvent(new FocusEvent('focusin', { bubbles: true, relatedTarget: null }));

        // Assert
        expect(second.classList.contains('tip-dismissed')).toBe(false);
        expect(first.classList.contains('tip-dismissed')).toBe(false);
    });

    it('ignores other keys and leaving elements that are not terms', () => {
        // Arrange
        initTips();
        const host = render(`${tip('fiNumber', 'FI number')}<span id="other"></span>`);
        const term = host.querySelector('.tip');

        // Act
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        const afterEnter = term.classList.contains('tip-dismissed');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        host.querySelector('#other').dispatchEvent(new MouseEvent('mouseout', { bubbles: true }));

        // Assert
        expect(afterEnter).toBe(false);
        expect(term.classList.contains('tip-dismissed')).toBe(true);
    });

    it('keeps a balloon hidden while the pointer moves inside its own term', () => {
        // Arrange
        initTips();
        const host = render(tip('fiNumber', 'FI number'));
        const term = host.querySelector('.tip');
        const box = term.querySelector('[role="tooltip"]');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        // Act
        term.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: box }));

        // Assert
        expect(term.classList.contains('tip-dismissed')).toBe(true);
    });
});
