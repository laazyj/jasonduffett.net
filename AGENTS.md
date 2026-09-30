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
**not** an npm dependency, so whether it is installed varies by environment.
When it isn't on `PATH`, the hook prints a `not found in PATH; skipping`
notice and lets the commit through, so always use a plain `git commit` —
**never `--no-verify`**. A missing gitleaks doesn't block, so the only thing
`--no-verify` would skip is a real finding.

When gitleaks does find something, remove the secret from the staged change.
If it is a false positive that is public by design, add it to the
`.gitleaks.toml` allowlist. When gitleaks is missing, GitHub's server-side
secret scanning and push protection are the backstop once the branch is
pushed.

## GitHub Actions audit (zizmor)

`npm run lint` runs zizmor over `.github/` (via `npm run lint:actions`) when it
is on `PATH`, and prints a skip note when it isn't. CI always runs it; see the
README's "GitHub Actions audit". A skip is expected, so don't install zizmor to
get past it. When it does run, its findings are real failures: fix them, or add
a `# zizmor: ignore[<audit>]` comment with a stated reason only when the
flagged behaviour is deliberate.

**IMPORTANT**: gitleaks and zizmor are the only analyser tools that may be
skipped, and only when they are not installed.

## Build system

Use npx nx to run build/test scripts — this is an nx monorepo.

**Use the Node version in [`.nvmrc`](.nvmrc)** (`nvm use` / `fnm use`). CI
reads the same file. Node 24 ships npm 11, which the lockfile is generated
with. npm 10 (bundled with Node 22) rewrites the lockfile on `npm install` —
silently stripping the `libc` fields npm 11 wrote and adding ~40 lines of
unrelated churn to the diff. That churn is not a defect in the lockfile and
does not want committing.

`npm ci` is safe under either version — it never writes the lockfile — so
running the suite on an older Node will not dirty the tree. The version
matters the moment you run `npm install`, `npm update`, or anything else that
resolves a new dependency.
