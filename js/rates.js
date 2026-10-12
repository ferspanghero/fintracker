// Latest daily exchange rates from the Bank of Canada Valet API (CORS-enabled,
// no key). Parsing is pure; fetching takes an injectable fetch for tests.

export const BOC_URL = 'https://www.bankofcanada.ca/valet/observations/FXUSDCAD,FXBRLCAD/json?recent=1';

function readRate(observation, series) {
    const value = Number(observation?.[series]?.v);

    if (!Number.isFinite(value) || value <= 0) {
        throw new Error(`Unexpected Bank of Canada response: no valid ${series}`);
    }

    return value;
}

/**
 * Extracts CAD-per-unit rates from a Valet observations response.
 * @param {object} json parsed response body
 * @returns {{USD: number, BRL: number, date: string}} rates from the latest observation
 * @throws {Error} when the latest observation is missing or malformed
 */
export function parseBocResponse(json) {
    const latest = json?.observations?.at(-1);

    if (!latest?.d) {
        throw new Error('Unexpected Bank of Canada response: no observation');
    }

    return { USD: readRate(latest, 'FXUSDCAD'), BRL: readRate(latest, 'FXBRLCAD'), date: latest.d };
}

/**
 * Fetches the latest USD → CAD and BRL → CAD rates.
 * @param {Function} fetchFn fetch-compatible function
 * @param {number} timeoutMs abort the request after this long
 * @returns {Promise<{USD: number, BRL: number, date: string}>}
 * @throws {Error} on network failure, timeout, HTTP error or a malformed body
 */
export async function fetchLatestRates(fetchFn = fetch, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetchFn(BOC_URL, { signal: controller.signal });

        if (!response.ok) {
            throw new Error(`Bank of Canada returned HTTP ${response.status}`);
        }

        return parseBocResponse(await response.json());
    } finally {
        clearTimeout(timer);
    }
}
