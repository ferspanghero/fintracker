import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The real page body (minus its module script), so DOM tests always see the
// same element ids as the app. Vitest runs from the repo root.
const indexHtml = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const body = indexHtml.match(/<body>([\s\S]*)<\/body>/)[1];

export const HTML_FIXTURE = body.replace(/<script[\s\S]*?<\/script>/g, '');
