import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: ['./tests/helpers/setup.js'],
        coverage: {
            provider: 'v8',
            include: ['js/**/*.js'],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 85,
                statements: 90
            }
        }
    }
});
