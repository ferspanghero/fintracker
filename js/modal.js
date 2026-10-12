// Shared dialog behaviour: showing and hiding, focus handling, and closing with
// the × button, a backdrop click or Escape. Every close goes through closeModal,
// which fires a "modal-close" event so owners can drop pending state.

const FOCUSABLE = 'input:not([type="hidden"]), select, textarea, button:not(.close)';
// The page behind the dialogs; made inert while one is open so Tab stays in the dialog.
const PAGE = '.container';
const returnTargets = new WeakMap();
// Open dialogs, most recent last: one can open over another (an import finishing while Add Transaction is open).
const openStack = [];
// Escape is handled by one document listener, however often initModals runs:
// a second listener would close two stacked dialogs with one key press.
let escapeWired = false;

const isOpen = modal => modal.style.display === 'block';
const isShowing = modal => modal.isConnected && isOpen(modal);

function forget(modal) {
    const index = openStack.indexOf(modal);

    if (index !== -1) {
        openStack.splice(index, 1);
    }
}

/**
 * Shows a dialog and moves focus into it (an element marked `data-autofocus` wins).
 * @param {HTMLElement} modal the `.modal` backdrop element
 * @param {{returnFocus?: HTMLElement}} [options] where focus goes on close; defaults to the focused element
 */
export function openModal(modal, { returnFocus = document.activeElement } = {}) {
    returnTargets.set(modal, returnFocus);
    forget(modal);
    openStack.push(modal);
    document.querySelector(PAGE)?.setAttribute('inert', '');
    modal.style.display = 'block';
    (modal.querySelector('[data-autofocus]') ?? modal.querySelector(FOCUSABLE))?.focus();
}

/**
 * Hides an open dialog, fires "modal-close" on it and returns focus to its return target.
 * @param {HTMLElement} modal the `.modal` backdrop element
 */
export function closeModal(modal) {
    if (!isOpen(modal)) {
        return;
    }

    modal.style.display = 'none';
    forget(modal);

    if (!openStack.some(isShowing)) {
        document.querySelector(PAGE)?.removeAttribute('inert');
    }

    modal.dispatchEvent(new Event('modal-close'));

    const target = returnTargets.get(modal);
    returnTargets.delete(modal);

    if (target?.isConnected) {
        target.focus();
    }
}

/** Wires × buttons and backdrop clicks for every `.modal`, and Escape for the topmost open one; call after the DOM is ready. */
export function initModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.querySelector('.close')?.addEventListener('click', () => closeModal(modal));
        modal.addEventListener('click', event => {
            if (event.target === modal) {
                closeModal(modal);
            }
        });
    });

    if (escapeWired) {
        return;
    }

    escapeWired = true;
    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') {
            return;
        }

        const top = openStack.findLast(isShowing);

        if (top) {
            closeModal(top);
        }
    });
}
