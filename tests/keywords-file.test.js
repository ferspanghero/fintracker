import { describe, it, expect, vi } from 'vitest';
import { importKeywordsFile, isMissingModuleError } from '../js/keywords-file.js';

describe('isMissingModuleError', () => {
    it.each([
        ['a browser fetch failure', new TypeError('Failed to fetch dynamically imported module')],
        ['a Node module-not-found error', Object.assign(new Error('Cannot find module'), { code: 'ERR_MODULE_NOT_FOUND' })]
    ])('treats %s as a missing file', (_, error) => {
        // Act, Assert
        expect(isMissingModuleError(error)).toBe(true);
    });

    it.each([
        ['a syntax error', new SyntaxError('Unexpected end of input')],
        ['any other error', new Error('Failed to parse source')],
        ['a missing error', undefined]
    ])('does not treat %s as a missing file', (_, error) => {
        // Act, Assert
        expect(isMissingModuleError(error)).toBe(false);
    });
});

describe('importKeywordsFile', () => {
    it('returns an empty module when no path is given', async () => {
        // Act, Assert
        expect(await importKeywordsFile()).toEqual({});
    });

    it('returns an empty module when the file is missing', async () => {
        // Act, Assert
        expect(await importKeywordsFile('./definitely-not-present-xyz.js')).toEqual({});
    });

    it('returns an empty module when the file is broken, so the app still starts', async () => {
        // Arrange
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        // Act, Assert
        expect(await importKeywordsFile('../tests/fixtures/broken-keywords.js')).toEqual({});
    });

    it('returns the module when the file loads', async () => {
        // Act
        const mod = await importKeywordsFile('../tests/fixtures/test-personal-keywords.js');

        // Assert
        expect(mod.personalKeywords.expense.Casa).toEqual(['zzsentinelcasazz']);
    });
});
