# Project Instructions

## After making changes

Always run lint and format checks after each task, before presenting work for review:

```sh
npm run lint
npm run format:check
```

Fix any issues before moving on. Use npm run lint:fix and npm run format to auto-fix.

## Committing (gitleaks pre-commit hook)

The husky `pre-commit` hook (`.husky/pre-commit`) runs a gitleaks secret scan
against staged changes. gitleaks is a standalone binary that is deliberately
**not** an npm dependency, so whether it is installed varies by environment —
**check before assuming, don't reach for `--no-verify` pre-emptively.**

Default to a plain `git commit` and let the hook run. If you want to know up
front whether the binary is present, test for it:

```sh
command -v gitleaks
```

If it is on `PATH`, the scan runs and passes for secret-free changes — just
commit normally. Only when the hook *actually* prints `gitleaks not found in
PATH` and exits non-zero (expected when the binary is genuinely missing, not a
failure to investigate) should you bypass it:

```sh
git commit --no-verify -m "..."
```

GitHub's server-side secret scanning and push protection are the backstop once
the branch is pushed, so skipping the local scan is safe for secret-free
changes. Do **not** use `--no-verify` if you are committing something that
might actually be a secret.

## Build system

Use npx nx to run build/test scripts — this is an nx monorepo.
