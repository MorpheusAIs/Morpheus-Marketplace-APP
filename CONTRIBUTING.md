# Contributing

## Branches

| Branch | Deploys |
|---|---|
| `dev` | https://app.dev.mor.org |
| `main` | https://app.mor.org |

AWS Amplify builds and deploys both branches. There is no `test` branch.

## How to submit a change

1. Branch from current `dev`:
   ```bash
   git fetch origin
   git checkout -b fix/your-topic origin/dev
   ```
2. Keep the change focused.
3. Open a pull request with base `dev`. If GitHub suggests `main` as the base, change it to `dev` before review.
4. If review sits for a while, merge current `origin/dev` into your branch.

Prefer commit titles with a conventional prefix: `feat:`, `fix:`, `docs:`, `chore:`.

Every pull request is a merge commit. Squash and rebase are off in this repository.

Only maintainers promote `dev` → `main`. The promote title is `promote: <summary> (dev -> main)`.

Local setup is in the [Local Developer Guide](.ai-docs/Local_Developer_Guide.md).

## Issues

File a bug, a feature request, or a docs correction with the issue forms. Questions are not tracked as issues; the API docs are at [apidocs.mor.org](https://apidocs.mor.org).

An issue closes when the change is on `main` and production has deployed. The local rules and the setup checklist are in [`.ai-docs/issue-tracker.md`](.ai-docs/issue-tracker.md). Maintainers follow the practice in `Morpheus-Maintainer-Context` (`.ai-docs/how-we-work.md`).

A feature or fix pull request targets `dev`. The body contains `Refs #123`, or the no-issue line for a chore, revert, or CI-only change. A promote pull request targets `main` and its title starts with `promote:`. A release pull request targets `main` and its title starts with `Release`. The **PR target** check fails any other pull request that does not target `dev`.
