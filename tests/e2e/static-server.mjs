// Minimal static file server for the Playwright suite (no dependencies).
// Serves only the app's own files, and only to requests addressed to this host.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const PORT = Number(process.env.PORT ?? 3100);
const HOSTS = new Set([`127.0.0.1:${PORT}`, `localhost:${PORT}`]);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
// The gitignored personal keywords stay unserved so specs don't depend on the developer's machine.
const isAppFile = path => path === '/index.html' || path === '/styles.css' ||
    (path.startsWith('/js/') && path.endsWith('.js') && path !== '/js/personal-keywords.js');

createServer(async (req, res) => {
    if (!HOSTS.has(req.headers.host)) {
        res.writeHead(403).end();
        return;
    }

    const pathname = normalize(decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    const path = pathname === '/' ? '/index.html' : pathname;

    if (!isAppFile(path)) {
        res.writeHead(404).end();
        return;
    }

    try {
        const body = await readFile(join(ROOT, path));
        res.writeHead(200, { 'Content-Type': TYPES[extname(path)] }).end(body);
    } catch {
        res.writeHead(404).end();
    }
}).listen(PORT, '127.0.0.1');
