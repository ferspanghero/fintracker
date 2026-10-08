// Fixture: a personal-keywords module that exports `ignorePrefixes`, including
// entries that need normalizing (case, padding), blank entries that must be
// dropped, and a non-string entry that must be skipped. Sentinel strings only —
// no real merchant or bank names.
export const ignorePrefixes = [
    '  Sentinel Transfer  ',
    'SENTINEL CARD PAYMENT',
    '',
    '   ',
    42
];
