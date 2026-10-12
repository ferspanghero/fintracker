// Tab bar: one visible panel at a time, following the WAI-ARIA tabs pattern.

let activate = () => {};

const allTabs = () => Array.from(document.querySelectorAll('[role="tab"]'));

/**
 * Shows the panel of `tabId`, hides the others and reports the activation.
 * @param {string} tabId id of a [role="tab"] button
 */
export function selectTab(tabId) {
    allTabs().forEach(tab => {
        const selected = tab.id === tabId;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        document.getElementById(tab.getAttribute('aria-controls')).hidden = !selected;
    });
    activate(tabId);
}

function handleKeydown(event) {
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];

    if (!step) {
        return;
    }

    const tabs = allTabs();
    const next = tabs[(tabs.indexOf(event.currentTarget) + step + tabs.length) % tabs.length];
    selectTab(next.id);
    next.focus();
}

/**
 * Wires the tab buttons; call once after the DOM is ready.
 * @param {{onActivate: Function}} options called with the tab id whenever a tab is selected
 */
export function initTabs({ onActivate }) {
    activate = onActivate;
    allTabs().forEach(tab => {
        tab.addEventListener('click', () => selectTab(tab.id));
        tab.addEventListener('keydown', handleKeydown);
    });
}
