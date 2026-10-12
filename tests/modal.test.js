import { describe, it, expect, vi } from 'vitest';
import { openModal, closeModal, initModals } from '../js/modal.js';

const modal = id => document.getElementById(id);
const isOpen = element => element.style.display === 'block';

describe('openModal', () => {
    it('shows the dialog and focuses its first field', () => {
        // Arrange
        const dialog = modal('add-transaction-modal');

        // Act
        openModal(dialog);

        // Assert
        expect(isOpen(dialog)).toBe(true);
        expect(document.activeElement).toBe(document.getElementById('transaction-date'));
    });

    it('makes the page behind the dialog inert until it closes', () => {
        // Arrange
        const page = document.querySelector('.container');
        const dialog = modal('import-result-modal');

        // Act
        openModal(dialog);
        const inertWhileOpen = page.hasAttribute('inert');
        closeModal(dialog);

        // Assert
        expect(inertWhileOpen).toBe(true);
        expect(page.hasAttribute('inert')).toBe(false);
    });

    it('focuses the element marked data-autofocus over earlier ones', () => {
        // Arrange
        const dialog = modal('restore-modal');

        // Act
        openModal(dialog);

        // Assert
        expect(document.activeElement).toBe(document.getElementById('restore-cancel-btn'));
    });
});

describe('closeModal', () => {
    it('hides the dialog, announces the close and returns focus to the opener', () => {
        // Arrange
        const opener = document.getElementById('add-transaction-btn');
        const dialog = modal('add-transaction-modal');
        const onClose = vi.fn();
        dialog.addEventListener('modal-close', onClose);
        opener.focus();
        openModal(dialog);

        // Act
        closeModal(dialog);

        // Assert
        expect(isOpen(dialog)).toBe(false);
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(document.activeElement).toBe(opener);
    });

    it('does nothing for a dialog that is not open', () => {
        // Arrange
        const dialog = modal('add-transaction-modal');
        const onClose = vi.fn();
        dialog.addEventListener('modal-close', onClose);

        // Act
        closeModal(dialog);

        // Assert
        expect(onClose).not.toHaveBeenCalled();
    });

    it('skips restoring focus when the opener is gone', () => {
        // Arrange
        const opener = document.getElementById('add-transaction-btn');
        const dialog = modal('add-transaction-modal');
        opener.focus();
        openModal(dialog);
        opener.remove();

        // Act
        closeModal(dialog);

        // Assert
        expect(isOpen(dialog)).toBe(false);
        expect(document.activeElement).not.toBe(opener);
    });

    it('returns focus to an explicit target instead of the opener', () => {
        // Arrange
        const target = document.getElementById('import-btn');
        const dialog = modal('import-result-modal');
        document.getElementById('text-filter').focus();
        openModal(dialog, { returnFocus: target });

        // Act
        closeModal(dialog);

        // Assert
        expect(document.activeElement).toBe(target);
    });
});

describe('initModals', () => {
    it('closes a dialog with its × button', () => {
        // Arrange
        initModals();
        const dialog = modal('import-result-modal');
        openModal(dialog);

        // Act
        dialog.querySelector('.close').click();

        // Assert
        expect(isOpen(dialog)).toBe(false);
    });

    it('closes a dialog when the backdrop is clicked but not when its content is', () => {
        // Arrange
        initModals();
        const dialog = modal('import-result-modal');
        openModal(dialog);

        // Act
        dialog.querySelector('.modal-content').click();
        const stillOpen = isOpen(dialog);
        dialog.click();

        // Assert
        expect(stillOpen).toBe(true);
        expect(isOpen(dialog)).toBe(false);
    });

    it('closes the open dialog on Escape', () => {
        // Arrange
        initModals();
        const dialog = modal('restore-modal');
        const onClose = vi.fn();
        dialog.addEventListener('modal-close', onClose);
        openModal(dialog);

        // Act
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        // Assert
        expect(isOpen(dialog)).toBe(false);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('handles a dialog opened over another: Escape closes the top one and the page stays inert until both close', () => {
        // Arrange
        initModals();
        const page = document.querySelector('.container');
        const lower = modal('add-transaction-modal');
        const upper = modal('import-result-modal');
        openModal(lower);
        openModal(upper);

        // Act
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        const afterFirst = { lower: isOpen(lower), upper: isOpen(upper), inert: page.hasAttribute('inert') };
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

        // Assert
        expect(afterFirst).toEqual({ lower: true, upper: false, inert: true });
        expect(isOpen(lower)).toBe(false);
        expect(page.hasAttribute('inert')).toBe(false);
    });

    it('ignores Escape when no dialog is open and other keys while one is', () => {
        // Arrange
        initModals();
        const dialog = modal('restore-modal');

        // Act
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        openModal(dialog);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

        // Assert
        expect(isOpen(dialog)).toBe(true);
    });
});
