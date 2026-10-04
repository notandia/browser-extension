# Wikimedia dataset attribution

The URL entries in `community_publishing_data.js` are adapted from Wikimedia contributors under [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/).

Sources and contributor histories:

- [Predatory publishers, revision 30328516](https://meta.wikimedia.org/w/index.php?title=Cite_Unseen/sources/predatory/publishers&oldid=30328516) — [history](https://meta.wikimedia.org/w/index.php?title=Cite_Unseen/sources/predatory/publishers&action=history)
- [Predatory standalone journals, revision 30328518](https://meta.wikimedia.org/w/index.php?title=Cite_Unseen/sources/predatory/standaloneJournals&oldid=30328518) — [history](https://meta.wikimedia.org/w/index.php?title=Cite_Unseen/sources/predatory/standaloneJournals&action=history)

Both editions are dated 30 March 2026. Notandia converts the CULink URL parameters into declarative data, normalises URL syntax, deduplicates equivalent entries and compiles hostname/path/query matching rules. Original URL entries, source editions and attribution remain embedded in the snapshot. These data adaptations retain the same CC BY-SA 4.0 licence. The surrounding extension code has its own licence.

The publisher list identifies Wikipedia’s predatory open-access source template and Beall-derived listings as its origins; the standalone-journal list identifies Beall’s standalone-journal list. A match reports membership in these attributed lists. Notandia does not independently reassess every listed website.

## Wikipedia CiteWatch

The same snapshot includes the complete `JCW-selected` publisher and journal records, their aliases, source keys, notes and associated `JCW-doi-redirects` prefixes from:

- [Publisher configuration, revision 1369144524](https://en.wikipedia.org/w/index.php?title=User:JL-Bot/Questionable.cfg/Publishers&oldid=1369144524), 13 August 2026 — [contributor history](https://en.wikipedia.org/w/index.php?title=User:JL-Bot/Questionable.cfg/Publishers&action=history).
- [Journal configuration, revision 1353634792](https://en.wikipedia.org/w/index.php?title=User:JL-Bot/Questionable.cfg/Journals&oldid=1353634792), 11 May 2026 — [contributor history](https://en.wikipedia.org/w/index.php?title=User:JL-Bot/Questionable.cfg/Journals&action=history).
- [False-positive exclusions, revision 1378216066](https://en.wikipedia.org/w/index.php?title=User:JL-Bot/Citations.cfg&oldid=1378216066) — [contributor history](https://en.wikipedia.org/w/index.php?title=User:JL-Bot/Citations.cfg&action=history). Only exclusions whose target occurs in the bundled publisher/journal records are adapted.

These adaptations are attributed to Wikipedia contributors and distributed under CC BY-SA 4.0. The offline importer converts wikitext parameters into declarative JSON; display formatting is converted to plain text and original parameter values remain in the snapshot. Name matching uses structured metadata with exact normalisation, skips short/generic aliases and applies source exclusions. Prefix/name signals are potential matches. Entries with journal-only publisher concerns or ambiguous names have restricted matching. This snapshot includes publisher/journal configuration coverage; other CiteWatch categories and Wikipedia citation-frequency rankings are separate.
