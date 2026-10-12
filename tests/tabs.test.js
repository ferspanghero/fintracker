import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initTabs, selectTab } from '../js/tabs.js';

const tab = id => document.getElementById(id);
const panelOf = id => document.getElementById(tab(id).getAttribute('aria-controls'));
const visiblePanels = () => Array.from(document.querySelectorAll('[role="tabpanel"]')).filter(p => !p.hidden).map(p => p.id);

describe('tabs', () => {
    let onActivate;

    beforeEach(() => {
        onActivate = vi.fn();
        initTabs({ onActivate });
    });

    it('starts on Transactions with the other panels hidden', () => {
        // Assert
        expect(tab('tab-transactions').getAttribute('aria-selected')).toBe('true');
        expect(visiblePanels()).toEqual(['panel-transactions']);
    });

    it.each(['tab-balance-sheet', 'tab-settings', 'tab-transactions'])('shows only the panel of %s when clicked', id => {
        // Act
        tab(id).click();

        // Assert
        expect(visiblePanels()).toEqual([panelOf(id).id]);
        expect(tab(id).getAttribute('aria-selected')).toBe('true');
        expect(document.querySelectorAll('[role="tab"][aria-selected="true"]')).toHaveLength(1);
        expect(onActivate).toHaveBeenCalledWith(id);
    });

    it('moves between tabs with the arrow keys', () => {
        // Act
        tab('tab-transactions').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));

        // Assert
        expect(visiblePanels()).toEqual(['panel-settings']);
        expect(document.activeElement).toBe(tab('tab-settings'));
    });

    it('moves right and wraps around', () => {
        // Arrange
        selectTab('tab-settings');

        // Act
        tab('tab-settings').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

        // Assert
        expect(visiblePanels()).toEqual(['panel-transactions']);
    });

    it('ignores other keys', () => {
        // Act
        tab('tab-transactions').dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));

        // Assert
        expect(onActivate).not.toHaveBeenCalled();
    });
});
