# NCBI provider registration

Notandia's local identifier mapper is the primary work-identity layer. NCBI is an optional biomedical identifier resolver.

## Public-package boundary

Do not embed a personal e-mail address, NCBI account name, or NCBI API key in a browser package. Browser extensions are inspectable after installation, so any embedded value must be treated as public.

The browser client currently sends the public tool label `NotandiaBrowser` and no account credential. NCBI lookups are disabled by default for new installations until the user enables them.

## Registration before release

Before enabling NCBI lookups by default in a public release:

1. create a public project contact address controlled by the Notandia maintainers;
2. register the tool label and contact address with NCBI using its documented process;
3. confirm any previous block or throttling has been cleared;
4. update the request only with the registered public project address;
5. never add a personal API key to source, manifests, build variables, release archives, or synchronized extension settings.

## Request policy

The client must:

- use the documented PMC ID Converter endpoint;
- send only validated DOI, PMID, or PMCID identifiers;
- batch and deduplicate identifiers;
- start no more than one NCBI request per second;
- cache successful responses in memory;
- honor `Retry-After`;
- stop network retries during 403/429 cooldowns;
- expose provider failure as unavailable or throttled rather than as a negative scholarly result.
