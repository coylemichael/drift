# Changelog fragments

`CHANGELOG.md` in this repository is generated. Its region between the two
`drift:changelog` marker comments is rebuilt from the files in this folder; the
text outside the markers is the project's own and is left alone.

To record a change, add one file here rather than editing `CHANGELOG.md`:

```markdown
---
date: "2026-10-09T16:29:21+01:00"
section: "Changed"
---
One bullet of Markdown. Further lines continue the same bullet; no blank lines.
```

`section` is one of Added, Changed, Deprecated, Removed, Fixed or Security.
Name the file after the work it records, uniquely (Drift names its own after the
artifact: `<feature>-<NNN>-<slug>.md`). Two people adding files never conflict;
two people editing one section always do. Entries are grouped by the first version
tag whose tree contains the file, or by day when the repository has no version tags.

A bullet in `CHANGELOG.md` is a one-way view of its fragment here: to change
it, edit the fragment and the region regenerates. Bullets edited directly in the
generated region, and lines added there without an id, are reported and not
regenerated over. Drift (https://github.com/coylemichael/drift)
regenerates the file at each publication and session start.
