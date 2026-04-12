// Fixture: a module that imports successfully but does NOT export
// `personalKeywords`. Used to verify loadCategoryKeywords falls back to
// generic-only keywords when the target file exists but is malformed.
export const somethingElse = 42;
