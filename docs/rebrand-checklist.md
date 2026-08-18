# Notandia rebrand checklist

## Public identity

- Extension name, popup, options, locale strings, icons, package descriptions, store-facing assets, and current documentation use **Notandia**.
- New general-purpose logs, DOM attributes, runtime APIs, tests, and documentation use the `Notandia` / `notandia` namespace.
- `MDPI` remains valid only where it refers to the actual MDPI publisher, its profile, domains, DOI prefix, or publisher-specific logic.

## Runtime migration

- Prefer `NotandiaDomains` / `NotandiaDomainUtils` over legacy domain aliases.
- Prefer `NotandiaNcbiApiHandler` over the released compatibility alias.
- Prefer `NotandiaSettings` for shared content-runtime settings.
- Assign `data-notandia-ref-id` to new scanned records.
- Use `data-notandia-doi` as the shared page identity when a work DOI is resolved.
- Keep legacy storage keys, runtime aliases, and DOM attributes only where the current packaged consumers or store-upgrade path still require them.

## Removal gate

Do not mechanically delete a legacy alias merely to eliminate an old token. Remove it only after:

1. every packaged consumer has migrated to the Notandia name;
2. upgrade-from-store testing confirms existing settings survive;
3. bibliography navigation/highlighting remains intact;
4. cross-browser builds pass without the alias;
5. the removal is covered by a regression test.

This boundary prevents the rebrand itself from causing another functional regression while ensuring no new feature expands the legacy namespace.
