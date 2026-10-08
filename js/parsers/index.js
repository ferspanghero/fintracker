import fintracker from './fintracker.js';
import amex from './amex.js';
import mastercard from './mastercard.js';
import simplii from './simplii.js';
import bradesco from './bradesco.js';
import td from './td.js';

// Order matters: most specific first, td last (fallback — always returns true from detect)
const parsers = [fintracker, amex, mastercard, simplii, bradesco, td];

export function getParserById(id) {
    return parsers.find(p => p.id === id) || null;
}

export function detectParser(headerRow) {
    // Some banks quote every header field ("Description","Type",...); detect() matches the bare text.
    const normalized = headerRow.toLowerCase().trim().replace(/"/g, '');
    for (const parser of parsers) {
        if (parser.detect(normalized)) return parser;
    }
    // Unreachable while td is present (its detect() always returns true) — defensive guard
    return null;
}

export { parsers };
