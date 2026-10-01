# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub:
**[Report a vulnerability](https://github.com/timoneiro/fronds/security/advisories/new)**
(the repo's *Security* tab → *Report a vulnerability*). Don't open a public issue for them.

Include what you found, how to reproduce it, and which part is affected: the app
(`timoneiro.github.io/fronds`) or the self-hosted server (`ghcr.io/timoneiro/fronds-server`).
fronds is a one-person project, so replies can take a few days.

## Supported versions

Only the latest version is supported. The app updates itself, and server fixes ship in the
`latest` image.

## How releases reach users

- The app is a static site on GitHub Pages. Its code is built from `main` by GitHub Actions and
  installed phones pick up the new version automatically, as with any website.
- Changes reach `main` only through pull requests that pass CI (lint, type check, tests, build).
- Dependencies are kept up to date by Dependabot, also through reviewed pull requests.
- Every user-facing change is listed in [CHANGELOG.md](CHANGELOG.md) and shown in the app.
