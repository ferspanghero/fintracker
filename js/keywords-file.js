// Imports the gitignored keywords file that the categorizer and the import
// ignore list both read from.

/**
 * Whether an import error means the file doesn't exist, as opposed to a file
 * that exists but is broken. Node reports a missing file as ERR_MODULE_NOT_FOUND;
 * browsers fail the fetch with a TypeError.
 * @param {unknown} error
 * @returns {boolean}
 */
export function isMissingModuleError(error) {
    return error instanceof TypeError || error?.code === 'ERR_MODULE_NOT_FOUND';
}

/**
 * Imports the keywords module at `path`, resolved relative to this file.
 * A missing file gives an empty module. So does a broken one, so the app still
 * starts, but it is reported: it silently turns off every keyword and ignore prefix.
 * @param {string} [path]
 * @returns {Promise<object>} the module's exports, or `{}`
 */
export async function importKeywordsFile(path) {
    if (!path) {
        return {};
    }

    try {
        return await import(path);
    } catch (error) {
        if (!isMissingModuleError(error)) {
            console.warn('[fintracker] keywords file failed to load; no keywords or ignore prefixes apply', error);
        }

        return {};
    }
}
