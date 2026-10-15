# Release archiving and citation

Zenodo's native GitHub integration is the preferred archive pipeline for this
repository. It archives published GitHub releases; ordinary pushes and pull
requests are not software releases. No additional GitHub Actions secret or
custom upload workflow is required.

## One-time setup

1. Add the repository's `CITATION.cff` before the first archived release.
2. Review Zenodo's GitHub OAuth permissions and organization-access request.
3. In Zenodo's GitHub settings, synchronize repositories and enable only
   `notandia/browser-extension` for this software's archiving.
4. Do not publish an unrelated manual deposit as a substitute for this pipeline.
   Existing releases are not automatically backfilled by simply enabling it.

## Each normal release

1. Complete the repository's existing build and verification steps, check the
   version manifests and inspect the release artifacts.
2. Check creator name, ORCID, repository URL and licensing in `CITATION.cff`.
   Do not add a stale version or date to that file. Do not create a second
   `.zenodo.json` without a specific need: it takes precedence over the CFF.
3. Publish the release through the existing GitHub release process. A release
   intended for archiving must contain the citation file in its tagged source.
4. Check the Zenodo integration's processing result, then open the public record.
   Verify the archived source, tag/version, date, creator/ORCID, licences and
   version relationships before describing it as archived.
5. Use the version-specific DOI when citing a particular release. Use the
   all-versions DOI for the software project generally. Once assigned, add the
   stable project DOI link/badge to the README and public software profile.

An enabled switch is configuration, not proof that a DOI was issued. A tagged
archive is not evidence of store approval or identical cross-browser behavior.
The separate Zotero plugin needs its own release/archive identity.

## Licence scope

The code is AGPL-3.0-or-later (`LICENSE-CODE`). The logo is CC BY-SA 4.0
(`LICENSE-LOGO`), and adapted Wikimedia community data retains its documented
attribution and CC BY-SA 4.0 terms (`shared/COMMUNITY_DATA_NOTICE.md`). Keep these
files in release archives. The software citation's licence field does not
replace the component-specific notices.

## References

- https://help.zenodo.org/docs/github/enable-repository/
- https://help.zenodo.org/docs/github/describe-software/citation-file/
- https://help.zenodo.org/docs/github/archive-software/github-upload/
