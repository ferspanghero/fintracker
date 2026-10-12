import { describe, it, expect, vi, afterEach } from 'vitest';
import { BOC_URL, parseBocResponse, fetchLatestRates } from '../js/rates.js';

const bocJson = (observations) => ({ seriesDetail: {}, observations });
const observation = (d, usd, brl) => ({ d, FXUSDCAD: { v: usd }, FXBRLCAD: { v: brl } });

describe('parseBocResponse', () => {
    it('reads both rates and the date from the latest observation', () => {
        // Arrange
        const json = bocJson([observation('2026-10-08', '1.4200', '0.2850'), observation('2026-10-09', '1.4271', '0.2860')]);

        // Act
        const rates = parseBocResponse(json);

        // Assert
        expect(rates).toEqual({ USD: 1.4271, BRL: 0.286, date: '2026-10-09' });
    });

    it.each([
        ['no observations', bocJson([])],
        ['a missing series', bocJson([{ d: '2026-10-09', FXUSDCAD: { v: '1.4' } }])],
        ['a non-numeric value', bocJson([observation('2026-10-09', 'n/a', '0.28')])],
        ['a zero value', bocJson([observation('2026-10-09', '0', '0.28')])],
        ['a missing date', bocJson([{ FXUSDCAD: { v: '1.4' }, FXBRLCAD: { v: '0.28' } }])],
        ['an empty body', null]
    ])('throws on %s', (_, json) => {
        // Act, Assert
        expect(() => parseBocResponse(json)).toThrow('Unexpected Bank of Canada response');
    });
});

describe('fetchLatestRates', () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it('requests the latest USD and BRL observation and parses it', async () => {
        // Arrange
        const fetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => bocJson([observation('2026-10-09', '1.4', '0.27')]) });

        // Act
        const rates = await fetchLatestRates(fetchFn);

        // Assert
        expect(fetchFn).toHaveBeenCalledWith(BOC_URL, expect.objectContaining({ signal: expect.any(AbortSignal) }));
        expect(BOC_URL).toBe('https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXBRLCAD/json?recent=1');
        expect(rates).toEqual({ USD: 1.4, BRL: 0.27, date: '2026-10-09' });
    });

    it('rejects on an HTTP error status', async () => {
        // Arrange
        const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 503 });

        // Act, Assert
        await expect(fetchLatestRates(fetchFn)).rejects.toThrow('Bank of Canada returned HTTP 503');
    });

    it('rejects on a network error', async () => {
        // Arrange
        const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

        // Act, Assert
        await expect(fetchLatestRates(fetchFn)).rejects.toThrow('Failed to fetch');
    });

    it('aborts after the timeout', async () => {
        // Arrange
        vi.useFakeTimers();
        const fetchFn = vi.fn((url, { signal }) => new Promise((resolve, reject) => {
            signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }));

        // Act
        const pending = fetchLatestRates(fetchFn, 50);
        const assertion = expect(pending).rejects.toThrow('Aborted');
        await vi.advanceTimersByTimeAsync(50);

        // Assert
        await assertion;
    });
});
