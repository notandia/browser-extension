# Notandia rebrand audit

The public product name is **Notandia**. The following categories are intentionally distinguished during the in-place upgrade.

## Replace now

- visible product labels and descriptions;
- diagnostic log prefixes that still say the previous product name;
- new general-purpose JavaScript globals;
- new DOM attributes and generated IDs;
- new documentation and tests.

## Keep temporarily as compatibility aliases

- released storage keys whose rename could reset user preferences;
- legacy message/runtime names still consumed by packaged modules;
- legacy DOM attributes still used by mature citation/navigation code;
- browser/store IDs required for update continuity.

## Keep as functional terminology

`MDPI`, `mdpi.com`, `mdpi.org`, DOI prefix `10.3390`, and the `mdpi` publisher-profile ID describe the publisher-specific feature and are not old product branding.

The migration is complete only when new code uses the Notandia namespace first and every remaining old namespace occurrence has an explicit compatibility reason.
