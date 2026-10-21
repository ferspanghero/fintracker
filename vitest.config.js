import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
    // The app imports its gitignored keywords file as './personal-keywords.js';
    // tests get the tracked stand-in instead, whether or not the real file exists.
    resolve: {
        alias: [{
            find: /^.*[\\/]js[\\/]personal-keywords\.js$/,
            replacement: fileURLToPath(new URL('./tests/fixtures/app-keywords.js', import.meta.url))
        }]
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/helpers/setup.js'],
        exclude: ['**/node_modules/**', 'tests/e2e/**'],
        coverage: {
            provider: 'v8',
            include: ['js/**/*.js'],
            exclude: ['js/personal-keywords.js'],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 85,
                statements: 90
            }
        }
    }
});
