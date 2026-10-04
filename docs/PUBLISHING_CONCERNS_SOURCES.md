# Publishing-concern presets — reviewed 4 October 2026

Defaults remain MDPI and Frontiers. The optional Additional publisher and journal warnings setting uses the full bundled Cite Unseen publisher and standalone-journal lists. It starts off for fresh and existing installations. Dataset entries remain separate from editable profile cards. Saved publisher profiles and manual domain rules override dataset matches, including disabled choices. User colors, actions and existing profiles survive migration. Matching runs locally; following a source link is a user action.

## Full dataset coverage

The bundle preserves all **1,334 publisher URL entries** from revision `30328516` and all **1,498 standalone-journal URL entries** from revision `30328518`. Both editions are dated 30 March 2026 and were verified as the latest revisions on 4 October 2026. Normalisation and deduplication produce 2,787 URL rules; these are website entries, not counts of distinct publishers or independently verified findings.

Hostname matching uses domain boundaries. Listed paths, query selectors and fragments retain their scope. For example, the listed `dovepress.com/core-evidence-journal` path matches that journal's path; another journal on DovePress stays unflagged. `scopemed.org/?jid=23` requires the listed journal selector. Hostname-only evidence cannot establish either journal-specific match. The additional dataset supplies URL coverage; DOI-only citations remain unidentified by this dataset until a matching website is available. Existing configured DOI rules remain supported.

Warnings identify source-list membership and link to the originating list and edition. The runtime uses indexed local matching and shows filters only for dataset entries actually matched on the page. Import/export stores the user's controls, not thousands of dataset entries.

The generator is `scripts/import-community-publishing.js`; its two inputs are the wikitext contents of the pinned revisions. It extracts CULink URL parameters and rejects unparsed templates or unsupported URL schemes. The generated `shared/community_publishing_data.js` contains declarative data. Attribution and the CC BY-SA 4.0 data licence ship in [COMMUNITY_DATA_NOTICE.md](../shared/COMMUNITY_DATA_NOTICE.md). Dataset updates should be reviewed, regenerated and tested before an extension release.

## Named publisher controls and explanations

| Preset | Matching coverage | Underlying assessment |
| --- | --- | --- |
| MDPI | mdpi.com, mdpi.org, preprints.org; 10.1989, 10.20944, 10.32545, 10.3390, 10.35995 | Institutional decisions, Wikipedia perennial-source assessment and CiteWatch |
| Frontiers | frontiersin.org; 10.3389, 10.4175 | Archived Beall’s List, Wikipedia discussion, CiteWatch and institutional decisions |
| OMICS | omicsonline.org; 10.4172 | Historical FTC case and court judgment |
| iMedPub | imedpub.com only | Same FTC case as OMICS |
| SCIRP | scirp.org only | Dated Wikimedia community publisher listing |
| Bentham Open | benthamopen.com, benthamopenarchives.com | Same community-list family as SCIRP |

## Provenance and limits

[CiteWatch revision 1378215500](https://en.wikipedia.org/w/index.php?title=Wikipedia:WikiProject_Academic_Journals/Journals_cited_by_Wikipedia/Questionable1&oldid=1378215500) reports Wikipedia citation usage as of 1 October 2026. It recommends case-by-case assessment for MDPI and Frontiers and records MDPI’s inclusion on Beall’s list in 2014 and removal in 2015. Its ranking measures Wikipedia citation frequency. The underlying [publisher configuration, revision 1369144524](https://en.wikipedia.org/w/index.php?title=User:JL-Bot/Questionable.cfg/Publishers&oldid=1369144524), supplies DOI candidates, source codes and exceptions.

Crossref prefix records checked on 4 October 2026 identify `10.1989`, `10.20944`, `10.32545` and `10.35995` as MDPI AG, and `10.4175` as Frontiers Media SA. Example works under `10.20944` use `preprints…` identifiers and have type `posted-content`; examples under `10.32545` use `encyclopedia…` identifiers and have type `posted-content`. The `10.1989` works endpoint returned no deposited works on review. These rules match identifiers; they do not resolve historical ownership transfers.

[Preprints.org](https://www.preprints.org/about) identifies its content as research shared before peer review and identifies MDPI as its supporter. Recognised Preprints.org references receive a separate type label and platform explanation. Recognised Encyclopedia entries receive their own type label. A primary journal DOI takes precedence over a linked preprint version.

[Publication Forum classification changes](https://julkaisufoorumi.fi/en/news/changes-classification) describes the 2025 downgrades, exceptions and restorations. [Norway’s assessment approach](https://kanalregister.hkdir.no/en/aktuelt/new-criteria-for-level-1) differs. The extension does not infer a current journal level from these publisher presets.

The [Wikipedia perennial-source assessment](https://en.wikipedia.org/w/index.php?title=Wikipedia:Reliable_sources/Perennial_sources&oldid=1374073585#MDPI) is pinned to revision 1374073585, dated 9 September 2026. It is community editorial guidance with its own context, not a universal scientific quality classification.

Frontiers appears in the original-list section of [beallslist.net](https://beallslist.net/). The [original-list changelog](https://beallslist.net/changelog-for-the-original-list/) records its addition on 19 October 2015. The site describes this section as an archive of Jeffrey Beall’s list, with updated links and notes.

The [February 2023 Wikipedia discussion](https://en.wikipedia.org/w/index.php?title=Wikipedia:Reliable_sources/Noticeboard/Archive_400&oldid=1146984485#RFC:_Frontiers_Media) includes arguments for both case-by-case caution and a generally unreliable rating. Revision 1146984485, dated 28 March 2023, was checked through the public MediaWiki API. The archived discussion has no formal closure recorded. Notandia describes the disagreement and links directly to it.

The [FTC OMICS case](https://search.ftc.gov/legal-library/browse/cases-proceedings/152-3113-omics-group-inc) covers OMICS Group, iMedPub and other defendants. Its 2019 judgment addresses deceptive publishing practices. It is historical evidence; identifiers do not establish present ownership. Crossref’s public prefix endpoint identified 10.4172 as OMICS Publishing Group on review. Unverified iMedPub DOI prefixes are omitted.

SCIRP and Bentham Open domain membership comes from the [Wikimedia community publisher list, revision 30328516](https://meta.wikimedia.org/w/index.php?title=Cite_Unseen/sources/predatory/publishers&oldid=30328516), dated 30 March 2026. Its stated origins include Wikipedia’s predatory open-access source template and an updated Beall’s list. These derived listings share an evidence family; multiple scripts or exports do not provide additional independent assessments. Matching uses the listed website and its verified redirect to benthamopenarchives.com. Website matching distinguishes Bentham Open from Bentham Science, which shares its DOI prefix. The archive domain was checked on 4 October 2026.

Wikimedia contributors are attributed through the pinned revisions and their histories; community material is available under [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). The interface preserves source attribution. OMICS/iMedPub retains the separate FTC case explanation. Frontiers retains its named control and existing source explanation; enabling the full dataset respects a disabled Frontiers choice.

## Coverage and future work

The popup denominator counts bibliography entries discovered by the bounded scanner (up to 300), excluding the current article and search-result cards. It is labelled scanned references, not all references or a percentage of unreliable papers. Older reports without coverage do not invent a denominator.

OpenAlex enrichment, journal assessment history, broader CiteWatch categories and PubPeer access remain future work. The bundled Cite Unseen URL lists add no external lookup provider. Formal article notices remain separate from source-list matches.

## Test pages for community warnings

Enable Additional publisher and journal warnings, save, then open one of these pages. These examples exercise the named publisher rules alongside the broader bundled dataset.

- [OMICS article](https://www.omicsonline.org/open-access/advancing-knowledge-synthesis-with-environmental-variable-associations-125387.html)
- [iMedPub article](https://medical-clinical-reviews.imedpub.com/articles/guidelines-for-fertility-preservation-in-gonadotoxic-treatment-patients.php?aid=53283)
- [SCIRP article](https://www.scirp.org/journal/paperinformation?paperid=152244)
- [Bentham Open journal archive](https://benthamopenarchives.com/journal-details.php?jid=TOBIOMTJ)

These pages provide examples of publisher matching. Page availability and layouts can change.

## Bundled CiteWatch identifiers and assessments

The optional warning group also includes all 1,381 publisher records and 2,122 journal records from the pinned CiteWatch configurations above. The journal snapshot is revision `1353634792` (11 May 2026). Both revisions were verified as current on 4 October 2026 through MediaWiki. Source codes, original notes, aliases and DOI redirect mappings are retained; 1,491 relevant target/entry exclusions are adapted from revision `1378216066` of `User:JL-Bot/Citations.cfg`.

Matching uses DOI prefixes and exact structured journal/publisher metadata (`citation_journal_title`, `citation_publisher`, journal-title and publisher microdata). It does not search arbitrary page prose for these names. Names/prefixes are potential signals: shared prefixes, earlier ownership and same-name journals require review. Short generic aliases, namesake/hijack exceptions and favourable reassessment notes restrict name-only matching. Publisher entries whose notes limit concerns to selected journals do not flag every article through the publisher prefix. Bentham’s shared `10.2174` prefix is excluded. Existing named publisher actions, colours and disabled choices take precedence; prefix and URL coverage avoid duplicate warnings. An existing URL-list match takes precedence over a fallback CiteWatch match for that reference.

Every CiteWatch match links its pinned configuration, the assessment origin when a known source key is present, the source-key guide and the exclusion snapshot. The existing group checkbox enables this coverage; no additional service requests or settings catalogue is introduced. The bot’s Wikipedia citation counts and ranking are not imported as quality measures. Other CiteWatch categories (general websites, self-published sources, mirrors and topical lists) remain outside this publisher/journal snapshot.

Rebuild from saved public MediaWiki API revision responses with `node scripts/import-citewatch.js configurations.json exclusions.json`. The importer rejects malformed DOI prefixes and unparsed redirects. The URL-list importer preserves the separately reviewed CiteWatch snapshot when refreshing Cite Unseen data. Attribution and contributor histories ship in `shared/COMMUNITY_DATA_NOTICE.md`.
