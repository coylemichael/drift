---
date: "2026-10-12T13:57:31+01:00"
section: "Added"
---
A GitHub Actions matrix runs the suite, typecheck and lint on Ubuntu, macOS and Windows for every push and pull request, so a change cannot land green on the authoring machine and break the next one to pull. The real-Pi tests run against the Pi the lockfile installs rather than whichever `pi` is first on `PATH` (`PI_TEST_BINARY` still selects another, such as the machine's global Pi, for a compatibility check); `.gitattributes` and `.editorconfig` pin LF line endings on every host; `npm run typecheck` and `npm run lint` name the two non-test checks; and the install docs ask you to keep Pi current, since Drift is developed against the pinned version.
