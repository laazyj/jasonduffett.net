# Project Instructions

## After making changes

Always run lint and format checks after each task, before presenting work for review:

```sh
npm run lint
npm run format:check
```

Fix any issues before moving on. Use npm run lint:fix and npm run format to auto-fix.

## Committing (pre-commit hook)

The husky `pre-commit` hook (`.husky/pre-commit`) runs two checks, each
backed by a standalone binary that is deliberately **not** an npm dependency:

- **gitleaks** scans staged changes for secrets.
- **zizmor** audits `.github/` for Actions security issues, only when the
  commit touches `.github/`.

Each is optional: if the binary isn't on `PATH`, the hook prints a
`not found in PATH; skipping` notice and carries on. So always use a plain
`git commit` — **never `--no-verify`**. A missing tool no longer blocks, so
the only thing `--no-verify` would skip is a real finding from a tool that
is installed.

When a check fails, it is a real finding:

- **gitleaks:** remove the secret from the staged change. If it is a false
  positive that is public by design, add it to the `.gitleaks.toml`
  allowlist.
- **zizmor:** fix it, or add an inline `# zizmor: ignore[<audit>]` with a
  comment saying why. The `zizmor` workflow fails on the same thing in CI.

When gitleaks is missing, GitHub's server-side secret scanning and push
protection are still the backstop once the branch is pushed.

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
