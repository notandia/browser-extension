from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

shared_path = ROOT / "shared" / "integrity.js"
shared = shared_path.read_text(encoding="utf-8")
if not shared.endswith("})();"):
    raise SystemExit("Unexpected shared/integrity.js ending")
shared_path.write_text(shared[:-5] + "});\n", encoding="utf-8")

test_path = ROOT / "tests" / "integrity.test.js"
tests = test_path.read_text(encoding="utf-8")
old_import = "  normalizeCrossrefEvents,\n  normalizeDOI,"
new_import = "  normalizeCrossrefEvents,\n  normalizeCrossrefUpdateRecords,\n  normalizeDOI,"
if old_import not in tests:
    raise SystemExit("Integrity test import marker not found")
tests = tests.replace(old_import, new_import, 1)

marker = "test('reinstatement supersedes an older retraction without deleting history', () => {"
fixture = """test('Crossref updates filter records classify the cited work', () => {\n  const events = normalizeCrossrefUpdateRecords([\n    {\n      DOI: '10.1038/s41586-024-07653-0',\n      'update-to': [{\n        DOI: '10.1038/nature00870',\n        type: 'retraction',\n        source: 'retraction-watch',\n        updated: { 'date-time': '2024-06-18T00:00:00Z' }\n      }]\n    },\n    {\n      DOI: '10.1000/unrelated-notice',\n      'update-to': [{ DOI: '10.1000/other-paper', type: 'retraction' }]\n    }\n  ], '10.1038/nature00870');\n\n  assert.equal(events.length, 1);\n  assert.equal(events[0].status, 'retracted');\n  assert.equal(events[0].noticeDoi, '10.1038/s41586-024-07653-0');\n  assert.equal(events[0].source, 'retraction-watch');\n});\n\n"""
if marker not in tests:
    raise SystemExit("Integrity test insertion marker not found")
tests = tests.replace(marker, fixture + marker, 1)

test_path.write_text(tests, encoding="utf-8")
