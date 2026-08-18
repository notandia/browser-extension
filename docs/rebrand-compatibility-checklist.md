# Rebrand compatibility checklist

- [x] Public product UI says Notandia.
- [x] New general-purpose domain API uses `NotandiaDomains` / `NotandiaDomainUtils`.
- [x] New NCBI resolver API uses `NotandiaNcbiApiHandler`.
- [x] New scan records receive `data-notandia-ref-id`.
- [x] MDPI remains only as publisher-specific terminology where appropriate.
- [ ] Remove each legacy runtime alias only after every packaged consumer has migrated and upgrade tests demonstrate it is safe.
