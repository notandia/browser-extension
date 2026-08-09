# Notandia runtime namespace migration

Notandia is the current product identity. New general-purpose runtime APIs, DOM attributes, log labels, UI text, tests, and documentation should use the `Notandia` / `notandia` namespace.

`MDPI` remains correct terminology when it identifies the MDPI publisher, its domains, DOI prefix, publisher profile, or MDPI-specific detection logic. It is not the product name.

## Compatibility aliases

The browser extension is an in-place update of software previously distributed as **MDPI Filter**. Some released runtime names, DOM attributes, storage keys, and browser identities cannot be removed in one step without risking upgrade regressions.

During migration:

- canonical domain APIs are `NotandiaDomains` and `NotandiaDomainUtils`;
- canonical NCBI resolver API is `NotandiaNcbiApiHandler`;
- canonical shared runtime settings object is `NotandiaSettings`;
- new scanned DOM records receive `data-notandia-ref-id`;
- the corresponding legacy names/attributes may be populated as aliases while older modules still consume them;
- new code must prefer the Notandia name and use the legacy name only as an explicit fallback or alias.

Compatibility aliases can be removed only after all packaged consumers have migrated and upgrade testing confirms that their removal does not reset settings, break navigation, or disrupt store update continuity.
