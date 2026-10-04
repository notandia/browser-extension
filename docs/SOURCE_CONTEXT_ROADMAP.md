# Proposed source-context roadmap

Research reviewed 4 October 2026. This document records implemented coverage and proposes further product and data changes.

## Recommendation

Keep the broad publisher scrutiny watchlist and its highlight/dim/hide controls. Add independent, attributed journal and article signals around it. Name the broad category **Publishing concerns**, with the explanation **Publishers and journals with documented editorial or peer-review concerns**. Use **Publisher watchlist** for a user's custom selections that have no evidence assessment attached.

MDPI and Frontiers retain different publisher colours. A publisher identity, a journal assessment, a formal notice, and a source type answer different questions. A positive journal listing should be available in details without turning the page green or clearing a publisher warning. An unknown journal should remain unassessed.

Wikipedia's [perennial sources page](https://en.wikipedia.org/wiki/Wikipedia:Reliable_sources/Perennial_sources#MDPI) describes MDPI publications as questionable, with peer-review/selectivity concerns. This supports an attributed publisher-level caution. Its assessment is scoped to Wikipedia sourcing, rather than a measured distribution of article quality. Frontiers needs its own rationale; MDPI's entry cannot be used for both.

## Underlying Wikipedia assessments and datasets

The supplied scripts are discovery routes to their underlying assessments and data sources. Evaluate and ingest those sources directly; comparing the scripts' interfaces is not the research objective.

| Underlying source | Useful contribution | Integration boundary |
|---|---|---|
| [Perennial sources](https://en.wikipedia.org/wiki/Wikipedia:Reliable_sources/Perennial_sources), with its linked reliable-source discussions | Public assessments, reasons and contextual exceptions; an explicit MDPI assessment | Keep the originating discussion and its scope. This is not a complete scholarly reliability database. |
| [Community predatory-publisher dataset](https://meta.wikimedia.org/wiki/Cite_Unseen/sources/predatory/publishers) and [standalone-journal dataset](https://meta.wikimedia.org/wiki/Cite_Unseen/sources/predatory/standaloneJournals) | Broad candidate coverage beyond MDPI and Frontiers | Their introductions identify Wikipedia/Beall-derived origins. Preserve those origins and historical limits; distinguish a listing from an independently established finding. |
| [New page patrol source guide](https://en.wikipedia.org/wiki/Wikipedia:New_page_patrol_source_guide) and WikiProject source lists referenced by the supplied scripts | Further community assessments, often scoped to particular subjects | Potential later coverage for web/news citations. Check each underlying discussion instead of applying every topic-specific rating universally. |
| [Generated source JSON](https://en.wikipedia.org/wiki/User:Novem_Linguae/Scripts/CiteHighlighter/SourcesJSON.js) | A machine-readable domain mapping into the above kinds of assessments | Useful as an ingestion aid, not the evidentiary authority. Retain the original assessment, edition and exceptions. |

Read-only MediaWiki API checks succeeded even where normal page retrieval failed. The inspected revisions were:

- CiteHighlighter documentation: revision `1350291157`, edited 21 April 2026.
- [CiteHighlighter SourcesJSON.js](https://en.wikipedia.org/wiki/User:Novem_Linguae/Scripts/CiteHighlighter/SourcesJSON.js): revision `1367496028`, edited 3 August 2026; declarative JSON despite its filename.
- [Cite Unseen publisher list](https://meta.wikimedia.org/wiki/Cite_Unseen/sources/predatory/publishers): revision `30328516`, edited 30 March 2026; 1,334 URL entries.
- [Cite Unseen standalone-journal list](https://meta.wikimedia.org/wiki/Cite_Unseen/sources/predatory/standaloneJournals): revision `30328518`, edited 30 March 2026; 1,498 URL entries.

These are URL entries, including duplicate and path-specific entries, not counts of independently verified predatory organisations. Matching candidates include OMICS/iMedPub, Bentham Open, SCIRP, Science Publishing Group and WASET; list membership alone is insufficient for a new Notandia verdict.

Build an optional **Community source warnings** pack from reviewed, pinned data. Display **Community predatory-publisher list** or **Wikipedia assessment: questionable** with the originating dataset/discussion and date. Do not silently turn community list membership into **Verified predatory**. Store an underlying assessment once, retaining its provenance even when several exports contain it.

Use structured data only. Never run third-party user scripts inside the extension. Preserve attribution and review the applicable data/code licences separately before distributing adapted data.

## APIs and scholarly datasets

| Source | Recommended role | Limits and priority |
|---|---|---|
| Crossref + Retraction Watch | Formal article notices; also retain journal title, ISSNs, work type and dates from already-requested DOI metadata | Existing integration. Extend the metadata we keep before adding redundant DOI requests. [Crossref documentation](https://support.crossref.org/hc/en-us/categories/201718146-Retrieving-metadata) distinguishes publisher deposits from Retraction Watch enrichment. |
| OpenAlex | Optional DOI-to-journal resolution, ISSN variants, publisher identity and dated journal-list membership | Best next general metadata integration. [Source-list documentation](https://help.openalex.org/data/source-lists/) preserves each scheme's names and loaded edition, but excludes level 0/pending/unevaluated states. Do not derive negative classifications from absence. |
| JUFO / Norwegian Register | Explicit journal assessment, evaluation history and changes | Obtain exact negative or discussion status directly from the source. [JUFO's current guide](https://julkaisufoorumi.fi/en/publication-forum/information-julkaisufoorumifi-site/jufo-portal-user-guide) supports ISSN searches and CSV exports with evaluation history. Validate reuse rights and ingestion before shipping a snapshot. |
| DOAJ | Factual inclusion context and a documented withdrawal reason when available | Absence is not a concern. Do not recreate the retired DOAJ Seal as a quality grade. [DOAJ's current metadata services](https://blog.doaj.org/2026/03/03/doajs-new-premium-metadata-services/) distinguish live API access from monthly public feeds. |
| PubPeer | Link to article discussion; eventually show **Discussion available** | Article-level context is valuable across all publishers. The [FAQ](https://pubpeer.com/static/faq) directs integrations to request an API key and says comments may be positive, negative or minor. Access remains unverified; do not scrape an undocumented endpoint or classify comment counts as misconduct. |
| Cabells | Possible licensed predatory-report integration | Defer until access, redistribution and cost are established. Not a prerequisite for a useful public release. |

Live OpenAlex checks returned 22 source lists and a journal record for *Land*, ISSN `2073-445X`, ID `S2738397068`, with `listed_in = [cwts-core, doaj, norway-1]`. This confirms technical feasibility and illustrates overlapping context. It does not establish a current JUFO classification: absence from JUFO lists must remain unknown.

[OpenAlex authentication documentation](https://help.openalex.org/api/authentication/) currently permits basic keyless access, with higher budgets through keys. Benchmark the required calls and cache behaviour before selecting access mode. Never distribute a personal API key; the documentation says it is also an account sign-in credential.

## Metrics worth showing

Prefer observable citation information:

- Matched watchlist references divided by all discovered references, with separate publisher counts.
- Distinct references with formal notices, with overlaps deduplicated.
- Coverage: discovered, identified, checked, deferred, failed and unassessed references.
- Source type where actually known: preprint, review, original study, opinion or another deposited type.
- Journal classifications with their own dates and labels, available in details.

For the MDPI example, **3 of 50 references match your publisher watchlist** is a useful factual result. It is not **6% unreliable**. Repeated inline citations should not inflate the bibliography denominator, and the current article should not be counted as one of its references.

Avoid an overall quality score, impact-factor thresholds, raw citation-count thresholds, or publisher-wide retraction-rate verdicts. [DORA](https://sfdora.org/read/) rejects journal metrics as proxies for individual article quality. A meaningful retraction-rate comparison would additionally require comparable periods, denominators, fields, notice coverage and correction practices.

Clicking a flagged citation can identify the reference and expose the warning. Determining whether the cited paper supports a particular statement requires reading the claim and the relevant paper; publisher identity cannot establish that relationship automatically.

## Implementation shape and release order

Current scope: MDPI and Frontiers controls, expanded verified DOI coverage, preprint/Encyclopedia type labels, the full optional bundled Cite Unseen URL lists and CiteWatch publisher/journal records, manual publisher adding, import/export, Reset defaults, diagnostic logging, source explanations, scanned-reference coverage, and Crossref/NCBI checks. Preset catalogues remain deferred. Saved profiles remain compatible. See [source scope and provenance](PUBLISHING_CONCERNS_SOURCES.md) for bundled rules and coverage.

1. Keep reliable counting, scan recovery and accessible publisher distinction as release prerequisites.
2. Keep Settings focused on publisher controls, the community warning group and manual custom filtering. Preserve saved profiles and controls.
3. Add an evidence registry separate from profile settings. Each entry has a stable ID, subject scope, identifiers, source URL/revision, attributed status/reason, assessment date, reviewed date, effective period, exceptions and underlying evidence origin.
4. Maintain the bundled publisher/journal URL lists through reviewed snapshots. OMICS/iMedPub also retains the [FTC case](https://search.ftc.gov/legal-library/browse/cases-proceedings/152-3113-omics-group-inc). Named publisher choices and manual domain rules override list matching.
5. The warning group now bundles CiteWatch publisher/journal records, DOI redirect mappings, source keys, notes and relevant exclusions. DOI and structured metadata-name matches are marked as potential. Further coverage can add other CiteWatch categories and verified journal identifiers.
6. Retain journal identity from existing Crossref lookups. Add opt-in OpenAlex enrichment only for missing identity/list context, with bounded batches, cache and provider-specific consent.
7. Add direct journal assessment snapshots and optional PubPeer discussion lookup after access and update paths are validated.

Snapshots should ship through reviewed extension updates initially. Show their edition and last review, preserve historical scope, and support removals/reversals. Live external checks need separate consent, minimal identifier transmission, withdrawal at the request boundary and clear unavailable states, following the current Crossref/NCBI approach.

Acceptance checks should cover host-versus-URL-text false positives, path-specific rules, DOI-prefix transfers, publication dates, journal exceptions, conflicting assessments, deduplication, stale data, provider failure, consent withdrawal and saved-profile migration. Publisher colours identify publishers; labelled icons/text identify concern types. Positive details should not visually certify every unflagged citation.

Suggested public description: **Notandia highlights publishers and journals that warrant closer scrutiny, connects citations to documented concerns, and checks individual papers for formal updates. Every warning explains its source.**
