# NCBI provider identification

Notandia's local identifier mapper is the primary work-identity layer. NCBI is an optional biomedical identifier resolver.

## Public-package boundary

Browser extensions are inspectable after installation, so every packaged value must be treated as public. Do not embed an NCBI account credential or API key in source, manifests, build variables, release archives, or synchronized extension settings.

The PMC Help Desk confirmed on 7 August 2026 that programmatic PMC ID Converter requests should include both `tool` and `email` parameters. Notandia therefore identifies the browser client with:

- `tool=NotandiaBrowser`
- `email=mario.marcolongo.dev@gmail.com`

The e-mail address is the project's public maintainer contact and is already publicly used for Notandia/MDPI Filter distribution. It is not an end-user identifier or a secret credential.

## Request policy

The PMC Help Desk also requested no more than three requests per second and no concurrent requests to the service. Notandia uses a stricter policy:

- use the documented PMC ID Converter endpoint;
- send only validated DOI, PMID, or PMCID identifiers;
- batch and deduplicate identifiers;
- serialize all requests globally so only one request is in flight at a time;
- start at most approximately one request per second;
- cache successful responses in memory;
- honor `Retry-After`;
- stop network retries during 403/429 cooldowns;
- expose provider failure as unavailable or throttled rather than as a negative scholarly result.

NCBI lookups remain independently controllable by the user. No NCBI API key is required or packaged for this integration.
