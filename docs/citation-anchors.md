# Citation anchors (per artifact)

Part of [Drift](../README.md). How `path:line` citations in artifacts are
anchored at publication and graded at pickup.

An artifact's `path:line` references rot as the code moves on, and a reading
session cannot tell a current claim from a stale one. At publication,
`drift_publish` records an anchor per citation in the artifact's frontmatter:
the range, a content hash of the cited lines (trailing whitespace stripped),
and the first and last lines as a search needle. When `/drift` or an automatic
continuation picks an artifact up, `scripts/check-staleness.py` grades every
citation against the tree and a single note tells the session what still
holds: `fresh` is proven by hash; `moved` is located and forwarded to its new
line or file; `changed` reports a difflib similarity; `gone` and `uncertain`
(no recorded commit, or anchored over uncommitted changes) say exactly what
could not be verified. Artifacts published before anchors existed are graded
heuristically from their recorded `git_commit`. The check is a report, never a
gate: it blocks nothing, writes nothing, and a checker failure degrades to one
"unavailable" note. Each check also appends one line to a local usefulness
ledger — `<agent dir>/drift/citation-metrics.jsonl`, verdict counts, mode and
artifact date, never in a repository — so the feature's exposure and the
corpus's rot rate can be measured over time. The checker also runs standalone:

```sh
python -I scripts/check-staleness.py drift/<feature>/<artifact>.md [<repo>]
```
